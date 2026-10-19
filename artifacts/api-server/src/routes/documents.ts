import { basename } from "node:path";
import { Readable } from "node:stream";
import {
  and,
  desc,
  eq,
  ilike,
  or,
} from "drizzle-orm";
import {
  CreateDocumentBody,
  CreateDocumentResponse,
  DeleteDocumentParams,
  GetDocumentParams,
  GetDocumentResponse,
  ListDocumentsQueryParams,
  ListDocumentsResponse,
  RequestDocumentUploadBody,
  RequestDocumentUploadResponse,
  UpdateDocumentBody,
  UpdateDocumentParams,
  UpdateDocumentResponse,
} from "@workspace/api-zod";
import { db, documentsTable } from "@workspace/db";
import { Router, type IRouter } from "express";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { requireTeacher } from "../lib/teacherAuth";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const allowedContentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const privateUploadPattern = /^\/objects\/uploads\/[0-9a-f-]{36}$/i;

function publicDocument(row: typeof documentsTable.$inferSelect) {
  const { objectPath: _objectPath, ...document } = row;
  return { ...document, createdAt: row.createdAt.toISOString() };
}

function safeFileName(fileName: string): string {
  return basename(fileName.replaceAll("\\", "/"))
    .replace(/[\r\n"]/g, "_")
    .slice(0, 255);
}

router.get("/documents", async (req, res): Promise<void> => {
  const parsed = ListDocumentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtres de recherche invalides." });
    return;
  }

  const { search, subject, level, semester } = parsed.data;
  const conditions = [];
  if (subject) conditions.push(eq(documentsTable.subject, subject));
  if (level) conditions.push(eq(documentsTable.level, level));
  if (semester) conditions.push(eq(documentsTable.semester, semester));
  if (search?.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(documentsTable.title, pattern),
        ilike(documentsTable.description, pattern),
        ilike(documentsTable.subject, pattern),
        ilike(documentsTable.level, pattern),
      ),
    );
  }

  const rows = await db
    .select()
    .from(documentsTable)
    .where(and(...conditions))
    .orderBy(desc(documentsTable.createdAt));

  res.json(ListDocumentsResponse.parse(rows.map(publicDocument)));
});

router.post(
  "/documents/upload-url",
  requireTeacher,
  async (req, res): Promise<void> => {
    const parsed = RequestDocumentUploadBody.safeParse(req.body);
    if (!parsed.success || !allowedContentTypes.has(parsed.data?.contentType ?? "")) {
      res.status(400).json({
        error: "Choisissez un PDF ou une image JPG, PNG ou WebP de 25 Mo maximum.",
      });
      return;
    }

    try {
      const uploadURL = await storage.getObjectEntityUploadURL();
      const objectPath = storage.normalizeObjectEntityPath(uploadURL);
      if (!privateUploadPattern.test(objectPath)) {
        req.log.error("Storage returned an invalid private object path");
        res.status(500).json({ error: "Impossible de préparer le téléversement." });
        return;
      }

      res.json(
        RequestDocumentUploadResponse.parse({
          uploadURL,
          objectPath,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Unable to create document upload URL");
      res.status(500).json({ error: "Impossible de préparer le téléversement." });
    }
  },
);

router.post(
  "/documents",
  requireTeacher,
  async (req, res): Promise<void> => {
    const parsed = CreateDocumentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Les informations du document sont invalides." });
      return;
    }
    const input = parsed.data;
    if (!privateUploadPattern.test(input.objectPath)) {
      res.status(400).json({ error: "Le fichier téléversé n'est pas valide." });
      return;
    }

    try {
      const objectFile = await storage.getObjectEntityFile(input.objectPath);
      const [metadata] = await objectFile.getMetadata();
      if (
        !allowedContentTypes.has(String(metadata.contentType)) ||
        metadata.contentType !== input.contentType ||
        Number(metadata.size) !== input.fileSize
      ) {
        res.status(400).json({
          error: "Le fichier téléversé ne correspond pas aux informations fournies.",
        });
        return;
      }

      const [row] = await db
        .insert(documentsTable)
        .values({
          title: input.title.trim(),
          description: input.description?.trim() ?? "",
          subject: input.subject.trim(),
          level: input.level.trim(),
          semester: input.semester.trim(),
          fileName: safeFileName(input.fileName),
          objectPath: input.objectPath,
          contentType: input.contentType,
          fileSize: input.fileSize,
        })
        .returning();

      if (!row) {
        res.status(500).json({ error: "Le document n'a pas pu être publié." });
        return;
      }
      res
        .status(201)
        .json(CreateDocumentResponse.parse(publicDocument(row)));
    } catch (error) {
      req.log.error({ err: error }, "Unable to publish document");
      if (error instanceof ObjectNotFoundError) {
        res.status(400).json({ error: "Le fichier téléversé est introuvable." });
        return;
      }
      res.status(500).json({ error: "Le document n'a pas pu être publié." });
    }
  },
);

router.get("/documents/:id", async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Identifiant de document invalide." });
    return;
  }

  const [row] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Document introuvable." });
    return;
  }
  res.json(GetDocumentResponse.parse(publicDocument(row)));
});

router.patch(
  "/documents/:id",
  requireTeacher,
  async (req, res): Promise<void> => {
    const params = UpdateDocumentParams.safeParse(req.params);
    const parsed = UpdateDocumentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Les informations du document sont invalides." });
      return;
    }

    const updates = {
      ...parsed.data,
      ...(parsed.data.title !== undefined && { title: parsed.data.title.trim() }),
      ...(parsed.data.description !== undefined && {
        description: parsed.data.description.trim(),
      }),
      ...(parsed.data.subject !== undefined && {
        subject: parsed.data.subject.trim(),
      }),
      ...(parsed.data.level !== undefined && { level: parsed.data.level.trim() }),
      ...(parsed.data.semester !== undefined && {
        semester: parsed.data.semester.trim(),
      }),
    };
    const [row] = await db
      .update(documentsTable)
      .set(updates)
      .where(eq(documentsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Document introuvable." });
      return;
    }
    res.json(UpdateDocumentResponse.parse(publicDocument(row)));
  },
);

router.delete(
  "/documents/:id",
  requireTeacher,
  async (req, res): Promise<void> => {
    const params = DeleteDocumentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Identifiant de document invalide." });
      return;
    }

    const [row] = await db
      .delete(documentsTable)
      .where(eq(documentsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Document introuvable." });
      return;
    }

    try {
      const objectFile = await storage.getObjectEntityFile(row.objectPath);
      await objectFile.delete({ ignoreNotFound: true });
    } catch (error) {
      req.log.warn({ err: error, documentId: row.id }, "Unable to remove stored file");
    }
    res.status(204).end();
  },
);

router.get("/documents/:id/file", async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Identifiant de document invalide." });
    return;
  }
  const [row] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Document introuvable." });
    return;
  }

  try {
    const objectFile = await storage.getObjectEntityFile(row.objectPath);
    const fileResponse = await storage.downloadObject(objectFile);
    res.status(fileResponse.status);
    fileResponse.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (fileResponse.body) {
      Readable.fromWeb(
        fileResponse.body as ReadableStream<Uint8Array>,
      ).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Fichier introuvable." });
      return;
    }
    req.log.error({ err: error, documentId: row.id }, "Unable to download document");
    res.status(500).json({ error: "Le téléchargement a échoué." });
  }
});

export default router;
