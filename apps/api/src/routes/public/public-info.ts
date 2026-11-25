import { Router } from 'express';
import type { AppDeps } from '../../types.js';
import { ApiError, badRequest } from '../../lib/http.js';
import { getPublicStatusCheck, verifyCertificatePublic } from '../../services/application.service.js';
import { requireFeatureFlag } from '../../middleware/feature-flag.js';
import { generateCertificatePdf, generateRecommendationLetterTemplatePdf } from '../../services/pdf.service.js';

export const publicInfoRouter = (deps: AppDeps): Router => {
  const router = Router();

  // Public status check: requires applicationNo and date of birth (DOB)
  router.get('/status-check', requireFeatureFlag(deps, 'public_status_check'), async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const applicationNo = String(req.query.applicationNo ?? '').trim();
      const dob = String(req.query.dob ?? '').trim();

      if (!applicationNo || !dob) {
        throw badRequest('PARAM_REQUIRED', 'Application number and Date of Birth (YYYY-MM-DD) are required');
      }

      const result = await getPublicStatusCheck({ prisma: deps.prisma }, applicationNo, dob);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Public certificate verification by serial number (JSON)
  router.get('/certificates/verify/:serialNo', requireFeatureFlag(deps, 'public_certificate_verify'), async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const serialNo = String(req.params.serialNo ?? '').trim();
      if (!serialNo) {
        throw badRequest('PARAM_REQUIRED', 'Certificate serial number is required');
      }

      const result = await verifyCertificatePublic({ prisma: deps.prisma }, serialNo);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Public certificate PDF download with QR Code
  router.get('/certificates/:serialNo/pdf', requireFeatureFlag(deps, 'public_certificate_verify'), async (req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const serialNo = String(req.params.serialNo ?? '').trim();
      if (!serialNo) {
        throw badRequest('PARAM_REQUIRED', 'Certificate serial number is required');
      }

      const result = await verifyCertificatePublic({ prisma: deps.prisma }, serialNo);

      const certRecord = await deps.prisma.certificate.findUnique({
        where: { serialNo },
        include: {
          application: {
            include: {
              student: true,
              directorate: true,
            },
          },
        },
      });

      const hostOrigin = deps.env?.PUBLIC_APP_ORIGIN ?? `${req.protocol}://${req.get('host')}`;
      const verifyUrl = `${hostOrigin}/verify?serial=${encodeURIComponent(serialNo)}`;

      const pdfBytes = await generateCertificatePdf({
        serialNo: result.serialNo,
        traineeName: result.traineeName ?? 'Trainee',
        collegeName: certRecord?.application.student.collegeName || 'Accredited Institution',
        degree: result.degree ?? 'Degree',
        discipline: result.discipline ?? 'Engineering',
        topic: result.topic ?? 'Project Work',
        directorateName: certRecord?.application.directorate?.name ?? 'Aeronautical Development Agency',
        guideName: 'Designated Project Guide',
        startDate: result.startDate ? new Date(result.startDate).toLocaleDateString() : 'Start Date',
        endDate: result.endDate ? new Date(result.endDate).toLocaleDateString() : 'End Date',
        issuedAt: new Date(result.issuedAt).toISOString(),
        issuedBy: certRecord?.issuedBy ?? 'Director (Admin & HR)',
        verifyUrl,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="ADA-Certificate-${serialNo.replace(/[/\\?%*:|"<>]/g, '_')}.pdf"`,
      );
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  // Blank Annexure-II format for student/college reference
  router.get('/guidelines/annexure-blank', async (_req, res, next) => {
    try {
      const pdfBytes = await generateRecommendationLetterTemplatePdf({
        studentName: '[STUDENT NAME]',
        collegeName: '[COLLEGE / INSTITUTION NAME]',
        degree: 'BE / B.Tech / ME / M.Tech',
        discipline: '[BRANCH OF STUDY]',
        semester: 6,
        cgpa: '[CGPA / %]',
        level: 'UG / PG',
        labName: 'Aeronautical Development Agency (ADA)',
        sponsorName: '[SPONSORING OFFICIAL]',
        durationWeeks: 12,
        startDate: '[START DATE]',
        endDate: '[END DATE]',
        topic: '[PROPOSED PROJECT WORK / TRAINING TOPIC]',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="ADA-Annexure-II-College-Recommendation-Blank.pdf"');
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  });

  // Policy instructions and metadata
  router.get('/guidelines', async (_req, res, next) => {
    try {
      if (!deps.prisma) throw new ApiError(503, 'DB_UNAVAILABLE', 'Database is not configured for this process');
      const directorates = await deps.prisma.directorate.findMany({
        where: { isActive: true },
        select: { code: true, name: true, ugCapacity: true, pgCapacity: true },
      });

      res.json({
        policy: {
          reference: 'ADA/ADM/EST/0267/4/S.Trng: 2025',
          date: '31 Dec 2025',
          eligibility: {
            ug: {
              category: 'BE / B.Tech (after 4th or 6th semester)',
              duration: '12 to 20 weeks',
              maxSeats: 50,
            },
            pg: {
              category: 'ME / M.Tech (3rd - 4th semester)',
              duration: '6 to 12 months',
              maxSeats: 25,
            },
          },
          stipend: 'No stipend, no industrial training, no fee.',
          attendance: '100% attendance required for certificate.',
          referralOnly: 'Open applications are disabled. Entry is strictly by referral code from ADA or DRDO employee.',
        },
        directorates,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
};
