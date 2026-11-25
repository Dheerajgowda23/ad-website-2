import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { ApiError, badRequest } from '../../lib/http.js';
import { makeRequireStudent } from '../../middleware/auth.js';
import {
  studentDraftSchema,
  studentSubmitSchema,
  studentEditSchema,
  documentUploadSchema,
  maskAadhaar,
} from '@ada/shared';
import {
  loadDetailedStudentApplication,
  saveStudentDraft,
  submitStudentApplication,
  editSubmittedApplication,
  withdrawStudentApplication,
  respondToStudentOffer,
  uploadStudentDocument,
  readStudentDocument,
} from '../../services/application.service.js';
import { downloadName } from '../../lib/storage.js';
import {
  generateRecommendationLetterTemplatePdf,
  generateApplicationSummaryPdf,
  generateOfferLetterPdf,
  generateCertificatePdf,
} from '../../services/pdf.service.js';

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
        { prisma: deps.prisma, env: deps.env },
        applicationId,
        parsed,
        req.ip ?? null,
      );
      res.status(201).json({ document: result });
    } catch (err) {
      next(err);
    }
  });

  // Download a document the student uploaded (own application only: the id comes
  // from the session, never from the request).
  router.get('/documents/:documentId/download', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const { document, file, buffer } = await readStudentDocument(
        { prisma: deps.prisma, env: deps.env },
        applicationId,
        String(req.params.documentId),
      );

      res.setHeader('Content-Type', file.mime || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadName(document.kind, file.storageKey.split('/').pop() ?? 'document')}"`,
      );
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  });

  // Download pre-filled college recommendation letter PDF
  router.get('/documents/recommendation-template', async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const app = await deps.prisma.application.findUnique({
        where: { id: applicationId },
        include: { student: true, lab: true, sponsor: true },
      });
      if (!app) throw badRequest('NOT_FOUND', 'Application not found');

      const pdfBytes = await generateRecommendationLetterTemplatePdf({
        studentName: app.student.fullName,
        collegeName: app.student.collegeName || 'Accredited Institution',
        degree: app.degree || 'Degree',
        discipline: app.discipline || 'Engineering',
        semester: app.semester || 6,
        cgpa: app.cgpa ? String(app.cgpa) : 'N/A',
        level: app.level,
        labName: app.lab.name,
        sponsorName: app.sponsor?.fullName ?? 'Employee',
        durationWeeks: app.durationWeeks,
        startDate: app.startDate ? app.startDate.toISOString().slice(0, 10) : null,
        endDate: app.endDate ? app.endDate.toISOString().slice(0, 10) : null,
        topic: app.topic,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ADA-College-Recommendation-${app.applicationNo || 'Template'}.pdf"`,
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  // Download application summary PDF
  router.get('/documents/summary-pdf', async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const app = await deps.prisma.application.findUnique({
        where: { id: applicationId },
        include: { student: true, lab: true, sponsor: true },
      });
      if (!app) throw badRequest('NOT_FOUND', 'Application not found');

      const pdfBytes = await generateApplicationSummaryPdf({
        applicationNo: app.applicationNo || 'Draft',
        intakeYear: app.intakeYear,
        studentName: app.student.fullName,
        email: app.student.email,
        phone: app.student.phone,
        gender: app.student.gender,
        dob: app.student.dob ? app.student.dob.toISOString().slice(0, 10) : '',
        nationality: app.student.nationality,
        aadhaarMasked: maskAadhaar(app.student.aadhaarLast4),
        collegeName: app.student.collegeName || 'Accredited Institution',
        degree: app.degree || '',
        discipline: app.discipline || '',
        semester: app.semester || 0,
        yearOfStudy: app.yearOfStudy || 0,
        cgpa: app.cgpa ? String(app.cgpa) : '',
        level: app.level,
        sponsorName: app.sponsor?.fullName ?? 'Employee',
        labName: app.lab.name,
        durationWeeks: app.durationWeeks,
        startDate: app.startDate ? app.startDate.toISOString().slice(0, 10) : null,
        endDate: app.endDate ? app.endDate.toISOString().slice(0, 10) : null,
        topic: app.topic,
        synopsis: app.synopsis,
        status: app.status,
        submittedAt: app.submittedAt ? app.submittedAt.toISOString() : null,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ADA-Application-${app.applicationNo || 'Summary'}.pdf"`,
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  // Download official offer letter PDF
  router.get('/documents/offer-letter', async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const app = await deps.prisma.application.findUnique({
        where: { id: applicationId },
        include: { student: true, directorate: true, offer: true },
      });
      if (!app) throw badRequest('NOT_FOUND', 'Application not found');

      if (!app.offer) {
        throw badRequest('OFFER_NOT_ISSUED', 'Offer letter is not yet available for this application');
      }

      const pdfBytes = await generateOfferLetterPdf({
        applicationNo: app.applicationNo || app.id,
        studentName: app.student.fullName,
        collegeName: app.student.collegeName || 'Accredited Institution',
        degree: app.degree || 'Degree',
        discipline: app.discipline || 'Engineering',
        level: app.level,
        directorateName: app.directorate?.name || 'Aeronautical Development Agency',
        guideName: 'Designated Project Guide',
        reportingDate: app.offer.reportingDate ? app.offer.reportingDate.toISOString().slice(0, 10) : 'TBD',
        durationWeeks: app.durationWeeks,
        issuedAt: app.offer.issuedAt.toISOString(),
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ADA-Offer-Letter-${app.applicationNo || 'Student'}.pdf"`,
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  // Download certificate PDF
  router.get('/documents/certificate', async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationId = String(res.locals.applicationId ?? '');
      const app = await deps.prisma.application.findUnique({
        where: { id: applicationId },
        include: { student: true, directorate: true, certificate: true },
      });
      if (!app) throw badRequest('NOT_FOUND', 'Application not found');

      if (!app.certificate) {
        throw badRequest('CERTIFICATE_NOT_ISSUED', 'Certificate has not been issued yet');
      }

      const hostOrigin = deps.env?.PUBLIC_APP_ORIGIN ?? `${req.protocol}://${req.get('host')}`;
      const verifyUrl = `${hostOrigin}/verify?serial=${encodeURIComponent(app.certificate.serialNo)}`;

      const pdfBytes = await generateCertificatePdf({
        serialNo: app.certificate.serialNo,
        traineeName: app.student.fullName,
        collegeName: app.student.collegeName || 'Accredited Institution',
        degree: app.degree || 'Degree',
        discipline: app.discipline || 'Engineering',
        topic: app.topic,
        directorateName: app.directorate?.name || 'Aeronautical Development Agency',
        guideName: 'Designated Project Guide',
        startDate: app.startDate ? app.startDate.toLocaleDateString() : 'Start Date',
        endDate: app.endDate ? app.endDate.toLocaleDateString() : 'End Date',
        issuedAt: app.certificate.issuedAt.toISOString(),
        issuedBy: app.certificate.issuedBy,
        verifyUrl,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ADA-Certificate-${app.certificate.serialNo.replace(/[/\\?%*:|"<>]/g, '_')}.pdf"`,
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  return router;
};
