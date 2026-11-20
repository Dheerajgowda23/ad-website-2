import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { ApiError } from '../../lib/http.js';
import { makeRequireStudent } from '../../middleware/auth.js';
import {
  studentDraftSchema,
  studentSubmitSchema,
  studentEditSchema,
  documentUploadSchema,
} from '@ada/shared';
import {
  loadDetailedStudentApplication,
  saveStudentDraft,
  submitStudentApplication,
  editSubmittedApplication,
  withdrawStudentApplication,
  respondToStudentOffer,
  uploadStudentDocument,
} from '../../services/application.service.js';

export const publicApplicationRouter = (deps: AppDeps): Router => {
  const router = Router();

  // All endpoints require a live public session scoped to an application
  router.use(makeRequireStudent(deps));

  router.get('/', async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const view = await loadDetailedStudentApplication({ prisma: deps.prisma }, applicationId);
      res.json({ application: view });
    } catch (err) {
      next(err);
    }
  });

  router.put('/draft', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const parsed = studentDraftSchema.parse(req.body);
      const result = await saveStudentDraft(
        { prisma: deps.prisma, env: deps.env },
        applicationId,
        parsed,
        req.ip ?? null,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/submit', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const parsed = studentSubmitSchema.parse(req.body);
      const result = await submitStudentApplication(
        { prisma: deps.prisma, env: deps.env },
        applicationId,
        parsed,
        req.ip ?? null,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const parsed = studentEditSchema.parse(req.body);
      const result = await editSubmittedApplication(
        { prisma: deps.prisma },
        applicationId,
        parsed,
        req.ip ?? null,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/withdraw', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const result = await withdrawStudentApplication(
        { prisma: deps.prisma },
        applicationId,
        req.ip ?? null,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/offer/respond', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const response = req.body?.response === 'ACCEPT' ? 'ACCEPT' : 'DECLINE';
      const result = await respondToStudentOffer(
        { prisma: deps.prisma },
        applicationId,
        response,
        req.ip ?? null,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/documents', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const parsed = documentUploadSchema.parse(req.body);
      const result = await uploadStudentDocument(
        { prisma: deps.prisma },
        applicationId,
        parsed,
        req.ip ?? null,
      );
      res.json({ document: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
