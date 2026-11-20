import { describe, expect, it } from 'vitest';
import {
  generateRecommendationLetterTemplatePdf,
  generateApplicationSummaryPdf,
  generateOfferLetterPdf,
  generateCertificatePdf,
} from '../src/services/pdf.service.js';

describe('PDF Generation and Security Artifacts', () => {
  it('generates a valid Annexure-II Recommendation Letter PDF', async () => {
    const pdfBytes = await generateRecommendationLetterTemplatePdf({
      studentName: 'Aarav Sharma',
      collegeName: 'National Institute of Technology Karnataka',
      degree: 'B.Tech',
      discipline: 'Mechanical Engineering',
      semester: 6,
      cgpa: '8.85',
      level: 'UG',
      labName: 'Aeronautical Development Agency (ADA)',
      sponsorName: 'Dr. Suresh Kumar, Sc G',
      durationWeeks: 16,
      startDate: '2026-06-01',
      endDate: '2026-09-20',
      topic: 'Aerodynamic Simulation of Delta Wing Vortex Breakdown',
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Verify PDF Magic Bytes (%PDF-)
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('generates a valid Application Summary PDF', async () => {
    const pdfBytes = await generateApplicationSummaryPdf({
      applicationNo: 'ADA/INT/R/2026/0042',
      intakeYear: 2026,
      studentName: 'Aarav Sharma',
      email: 'aarav@college.edu.in',
      phone: '+91 98765 43210',
      gender: 'Male',
      dob: '2004-05-15',
      nationality: 'Indian',
      aadhaarMasked: 'XXXX XXXX 4321',
      collegeName: 'NITK Surathkal',
      degree: 'B.Tech',
      discipline: 'Aerospace Engineering',
      semester: 6,
      yearOfStudy: 3,
      cgpa: '9.10',
      level: 'UG',
      sponsorName: 'Dr. Suresh Kumar',
      labName: 'ADA Bengaluru',
      durationWeeks: 16,
      startDate: '2026-06-01',
      endDate: '2026-09-20',
      topic: 'Flight Control Laws Design for LCA Tejas Mark 2',
      synopsis: 'Investigation of high angle of attack stability and digital fly-by-wire control laws for supersonic aircraft.',
      status: 'SUBMITTED',
      submittedAt: new Date().toISOString(),
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('generates an official ADA Offer Letter PDF', async () => {
    const pdfBytes = await generateOfferLetterPdf({
      applicationNo: 'ADA/INT/R/2026/0042',
      studentName: 'Aarav Sharma',
      collegeName: 'NITK Surathkal',
      degree: 'B.Tech',
      discipline: 'Aerospace Engineering',
      level: 'UG',
      directorateName: 'Flight Mechanics & Control',
      guideName: 'Dr. Ramesh Babu, Scientist F',
      reportingDate: '2026-06-01',
      durationWeeks: 16,
      issuedAt: new Date().toISOString(),
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('generates an official Certificate of Completion with embedded QR Code', async () => {
    const pdfBytes = await generateCertificatePdf({
      serialNo: 'ADA/CERT/2026/0042',
      traineeName: 'Aarav Sharma',
      collegeName: 'NITK Surathkal',
      degree: 'B.Tech',
      discipline: 'Aerospace Engineering',
      topic: 'Flight Control Laws Design for LCA Tejas Mark 2',
      directorateName: 'Flight Mechanics & Control',
      guideName: 'Dr. Ramesh Babu',
      startDate: '01 June 2026',
      endDate: '20 September 2026',
      issuedAt: new Date().toISOString(),
      issuedBy: 'Director (Admin & HR)',
      verifyUrl: 'http://localhost:5173/verify?serial=ADA%2FCERT%2F2026%2F0042',
    });

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);
    const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
    expect(header).toBe('%PDF-');
  });
});
