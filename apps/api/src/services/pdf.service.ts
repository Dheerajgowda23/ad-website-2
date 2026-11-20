import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

export interface RecommendationTemplateData {
  studentName?: string | null;
  collegeName?: string | null;
  degree?: string | null;
  discipline?: string | null;
  semester?: number | string | null;
  cgpa?: string | number | null;
  level?: string | null;
  labName?: string | null;
  sponsorName?: string | null;
  durationWeeks?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  topic?: string | null;
}

export interface ApplicationSummaryData {
  applicationNo?: string | null;
  intakeYear?: number | null;
  studentName?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  nationality?: string | null;
  aadhaarMasked?: string | null;
  collegeName?: string | null;
  degree?: string | null;
  discipline?: string | null;
  semester?: number | string | null;
  yearOfStudy?: number | string | null;
  cgpa?: string | number | null;
  level?: string | null;
  sponsorName?: string | null;
  labName?: string | null;
  durationWeeks?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  topic?: string | null;
  synopsis?: string | null;
  status?: string | null;
  submittedAt?: string | null;
}

export interface OfferLetterData {
  applicationNo?: string | null;
  studentName?: string | null;
  collegeName?: string | null;
  degree?: string | null;
  discipline?: string | null;
  level?: string | null;
  directorateName?: string | null;
  guideName?: string | null;
  reportingDate?: string | null;
  durationWeeks?: number | null;
  issuedAt?: string | null;
}

export interface CertificatePdfData {
  serialNo: string;
  traineeName?: string | null;
  collegeName?: string | null;
  degree?: string | null;
  discipline?: string | null;
  topic?: string | null;
  directorateName?: string | null;
  guideName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  issuedAt?: string | null;
  issuedBy?: string | null;
  verifyUrl: string;
}

const NAVY = rgb(0.08, 0.18, 0.36);
const SLATE = rgb(0.3, 0.35, 0.42);
const DARK = rgb(0.1, 0.1, 0.1);
const LIGHT_BG = rgb(0.96, 0.97, 0.99);
const BORDER_COLOR = rgb(0.8, 0.85, 0.9);

/**
 * Pre-filled College Recommendation Letter (Annexure-II).
 * Student downloads this, gets it printed, signed and stamped by Principal/HoD, then uploads it.
 */
export async function generateRecommendationLetterTemplatePdf(
  data: RecommendationTemplateData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  let y = 800;

  // Header
  page.drawText('AERONAUTICAL DEVELOPMENT AGENCY', {
    x: 130,
    y,
    size: 15,
    font: fontBold,
    color: NAVY,
  });
  y -= 16;
  page.drawText('Ministry of Defence, Government of India', {
    x: 185,
    y,
    size: 10,
    font,
    color: SLATE,
  });
  y -= 14;
  page.drawText('P.B. No. 1718, Vimanapura Post, Bengaluru - 560 017', {
    x: 165,
    y,
    size: 9,
    font,
    color: SLATE,
  });
  y -= 25;

  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1.5,
    color: NAVY,
  });
  y -= 20;

  // Title Box
  page.drawRectangle({
    x: 50,
    y: y - 24,
    width: 495,
    height: 30,
    color: LIGHT_BG,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });
  page.drawText('ANNEXURE - II: COLLEGE RECOMMENDATION & BONAFIDE CERTIFICATE', {
    x: 75,
    y: y - 14,
    size: 10.5,
    font: fontBold,
    color: NAVY,
  });
  y -= 45;

  page.drawText(
    '(To be printed on College Letterhead, signed with Seal by Principal / Head of Institution)',
    { x: 90, y, size: 8.5, font: fontOblique, color: SLATE },
  );
  y -= 25;

  // Student details section
  page.drawText('PARTICULARS OF CANDIDATE', { x: 50, y, size: 10, font: fontBold, color: NAVY });
  y -= 15;

  const drawRow = (label: string, val: string | number | null | undefined, curY: number) => {
    page.drawText(label, { x: 55, y: curY, size: 9, font: fontBold, color: DARK });
    page.drawText(`:  ${val != null ? String(val) : 'N/A'}`, { x: 180, y: curY, size: 9, font, color: DARK });
  };

  drawRow('1. Full Name of Student', data.studentName, y);
  y -= 18;
  drawRow('2. College / Institution', data.collegeName, y);
  y -= 18;
  drawRow('3. Degree & Discipline', `${data.degree || 'Degree'} - ${data.discipline || 'Engineering'}`, y);
  y -= 18;
  drawRow('4. Current Semester / Year', `Semester ${data.semester ?? '—'} (${data.level || 'UG'})`, y);
  y -= 18;
  drawRow('5. Cumulative CGPA / %', data.cgpa, y);
  y -= 18;
  drawRow('6. DRDO Sponsoring Lab', `${data.labName || 'ADA'} (Ref: ${data.sponsorName || 'Employee'})`, y);
  y -= 18;
  drawRow('7. Proposed Duration', `${data.durationWeeks ?? 16} Weeks (${data.startDate || 'Tentative'} to ${data.endDate || 'Tentative'})`, y);
  y -= 18;
  drawRow('8. Area of Training / Topic', (data.topic || 'Aeronautical / Engineering Project Work').slice(0, 65), y);
  y -= 30;

  // Institutional Endorsement
  page.drawText('INSTITUTIONAL ENDORSEMENT & UNDERTAKING', { x: 50, y, size: 10, font: fontBold, color: NAVY });
  y -= 18;

  const endorsementParagraphs = [
    `1. This is to certify that Mr./Ms. ${data.studentName || 'the student'} is a bonafide regular student of ${data.collegeName || 'this college'}, pursuing ${data.degree || 'Degree'} in ${data.discipline || 'Engineering'}.`,
    `2. The student has cleared all previous semester examinations with no pending backlogs and holds good moral character and conduct.`,
    `3. The college / university has no objection to the student undergoing project work / internship training at Aeronautical Development Agency (ADA), Bengaluru.`,
    `4. The college undertakes that the student will strictly abide by the security and confidentiality rules of ADA and will not demand any stipend, accommodation or transportation.`,
    `5. The student will maintain 100% attendance during the approved period and follow all instructions of the designated ADA Project Guide.`,
  ];

  for (const p of endorsementParagraphs) {
    page.drawText(p, { x: 55, y, size: 8.5, font, color: DARK, maxWidth: 485, lineHeight: 12 });
    y -= 26;
  }

  y -= 15;

  // Signatures Grid
  const sigY = y;
  page.drawRectangle({
    x: 50,
    y: sigY - 110,
    width: 235,
    height: 110,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });
  page.drawRectangle({
    x: 310,
    y: sigY - 110,
    width: 235,
    height: 110,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });

  page.drawText('Signature of Head of Department', { x: 70, y: sigY - 20, size: 8.5, font: fontBold, color: SLATE });
  page.drawText('Name:', { x: 60, y: sigY - 50, size: 8, font, color: SLATE });
  page.drawText('Department:', { x: 60, y: sigY - 70, size: 8, font, color: SLATE });
  page.drawText('Date:', { x: 60, y: sigY - 90, size: 8, font, color: SLATE });

  page.drawText('Signature of Principal / Head of Institution', { x: 320, y: sigY - 20, size: 8.5, font: fontBold, color: SLATE });
  page.drawText('(With College Official Seal / Stamp)', { x: 350, y: sigY - 32, size: 7.5, font: fontOblique, color: SLATE });
  page.drawText('Name:', { x: 320, y: sigY - 60, size: 8, font, color: SLATE });
  page.drawText('Designation:', { x: 320, y: sigY - 75, size: 8, font, color: SLATE });
  page.drawText('Phone / Email:', { x: 320, y: sigY - 90, size: 8, font, color: SLATE });

  y = sigY - 135;

  // Footer Instructions
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: SLATE });
  y -= 14;
  page.drawText(
    'Instruction to Student: Scan the signed and stamped document as a PDF/JPG (max 5 MB) and upload it under the Documents tab.',
    { x: 50, y, size: 7.5, font: fontOblique, color: NAVY },
  );

  return doc.save();
}

/**
 * Covering Letter / Application Summary PDF.
 */
export async function generateApplicationSummaryPdf(
  data: ApplicationSummaryData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  let y = 800;

  // Header
  page.drawText('AERONAUTICAL DEVELOPMENT AGENCY', { x: 140, y, size: 14, font: fontBold, color: NAVY });
  y -= 15;
  page.drawText('Ministry of Defence, Government of India — Bengaluru', { x: 165, y, size: 9.5, font, color: SLATE });
  y -= 20;

  page.drawRectangle({
    x: 50,
    y: y - 26,
    width: 495,
    height: 30,
    color: LIGHT_BG,
    borderColor: BORDER_COLOR,
    borderWidth: 1,
  });
  page.drawText(`APPLICATION SUMMARY — ${data.applicationNo || 'Draft'}`, {
    x: 130,
    y: y - 16,
    size: 11,
    font: fontBold,
    color: NAVY,
  });
  y -= 45;

  const drawField = (label: string, val: string | number | null | undefined, xPos: number, curY: number) => {
    page.drawText(label, { x: xPos, y: curY, size: 8.5, font: fontBold, color: DARK });
    page.drawText(`: ${val != null ? String(val) : 'N/A'}`, { x: xPos + 105, y: curY, size: 8.5, font, color: DARK });
  };

  // Section 1: Referral & Status
  page.drawText('1. REFERRAL & METADATA', { x: 50, y, size: 9.5, font: fontBold, color: NAVY });
  y -= 15;
  drawField('Intake Year', data.intakeYear ? String(data.intakeYear) : '2026', 55, y);
  drawField('Current Status', data.status, 300, y);
  y -= 16;
  drawField('Sponsoring Lab', data.labName, 55, y);
  drawField('Referred By', data.sponsorName, 300, y);
  y -= 24;

  // Section 2: Personal Particulars
  page.drawText('2. CANDIDATE PARTICULARS', { x: 50, y, size: 9.5, font: fontBold, color: NAVY });
  y -= 15;
  drawField('Candidate Name', data.studentName, 55, y);
  drawField('Gender / DOB', `${data.gender || '—'} / ${data.dob || '—'}`, 300, y);
  y -= 16;
  drawField('Email Address', data.email, 55, y);
  drawField('Mobile Phone', data.phone, 300, y);
  y -= 16;
  drawField('Nationality', data.nationality, 55, y);
  drawField('Aadhaar (Masked)', data.aadhaarMasked, 300, y);
  y -= 24;

  // Section 3: Academic Profile
  page.drawText('3. ACADEMIC PROFILE', { x: 50, y, size: 9.5, font: fontBold, color: NAVY });
  y -= 15;
  drawField('College / Univ', (data.collegeName || 'Accredited Institution').slice(0, 32), 55, y);
  drawField('Degree / Branch', `${data.degree || ''} - ${data.discipline || ''}`, 300, y);
  y -= 16;
  drawField('Semester / Year', `Sem ${data.semester ?? '—'} (Yr ${data.yearOfStudy ?? '—'})`, 55, y);
  drawField('CGPA / Percentage', data.cgpa, 300, y);
  y -= 24;

  // Section 4: Training Preferences
  page.drawText('4. TRAINING PROJECT DETAILS', { x: 50, y, size: 9.5, font: fontBold, color: NAVY });
  y -= 15;
  drawField('Training Level', data.level, 55, y);
  drawField('Duration (Weeks)', `${data.durationWeeks ?? 16} Weeks`, 300, y);
  y -= 16;
  drawField('Proposed Period', `${data.startDate || 'TBD'} to ${data.endDate || 'TBD'}`, 55, y);
  y -= 18;
  page.drawText('Project Topic / Area:', { x: 55, y, size: 8.5, font: fontBold, color: DARK });
  y -= 14;
  page.drawText(data.topic || 'Aeronautical Project Work', { x: 55, y, size: 8.5, font, color: DARK, maxWidth: 480, lineHeight: 12 });
  y -= 30;

  if (data.synopsis) {
    page.drawText('Project Synopsis (Applicant Summary):', { x: 55, y, size: 8.5, font: fontBold, color: DARK });
    y -= 14;
    page.drawText(data.synopsis.slice(0, 450), { x: 55, y, size: 8, font, color: DARK, maxWidth: 480, lineHeight: 11 });
    y -= 45;
  }

  // Section 5: Student Declaration
  page.drawText('5. CANDIDATE DECLARATION', { x: 50, y, size: 9.5, font: fontBold, color: NAVY });
  y -= 15;
  page.drawText(
    'I hereby declare that all information furnished in this application is true, complete and correct. I am an Indian citizen. I understand that internship at ADA carries no stipend or employment commitment and 100% attendance is mandatory.',
    { x: 55, y, size: 8, font: fontOblique, color: DARK, maxWidth: 480, lineHeight: 11 },
  );
  y -= 40;

  page.drawText(`Date: ${data.submittedAt ? new Date(data.submittedAt).toLocaleDateString() : new Date().toLocaleDateString()}`, {
    x: 55,
    y,
    size: 8.5,
    font,
    color: SLATE,
  });
  page.drawText(`Candidate Signature: ${data.studentName || 'Student'} (Digitally Verified)`, {
    x: 290,
    y,
    size: 8.5,
    font: fontBold,
    color: NAVY,
  });

  return doc.save();
}

/**
 * Official Offer Letter PDF.
 */
export async function generateOfferLetterPdf(data: OfferLetterData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  let y = 800;

  // Letterhead
  page.drawText('AERONAUTICAL DEVELOPMENT AGENCY', { x: 135, y, size: 14, font: fontBold, color: NAVY });
  y -= 15;
  page.drawText('Ministry of Defence, Government of India', { x: 185, y, size: 9.5, font, color: SLATE });
  y -= 13;
  page.drawText('P.B. No. 1718, Vimanapura Post, Bengaluru - 560 017, Karnataka, India', { x: 125, y, size: 8.5, font, color: SLATE });
  y -= 20;

  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1.5, color: NAVY });
  y -= 25;

  // Ref and Date
  const currentYear = new Date().getFullYear();
  page.drawText(`Ref: ADA/ADM/TRNG/${currentYear}/${data.applicationNo || 'PROV'}`, { x: 50, y, size: 9, font: fontBold, color: DARK });
  page.drawText(`Date: ${new Date(data.issuedAt || Date.now()).toLocaleDateString()}`, { x: 420, y, size: 9, font, color: DARK });
  y -= 30;

  // Addressee
  page.drawText('To,', { x: 50, y, size: 9.5, font: fontBold, color: DARK });
  y -= 15;
  page.drawText(data.studentName || 'Candidate', { x: 50, y, size: 9.5, font: fontBold, color: NAVY });
  y -= 14;
  page.drawText(data.collegeName || 'Accredited Institution', { x: 50, y, size: 9, font, color: DARK });
  y -= 14;
  page.drawText(`Programme: ${data.degree || 'Degree'} (${data.discipline || 'Engineering'})`, { x: 50, y, size: 9, font, color: SLATE });
  y -= 28;

  // Subject
  page.drawText('Sub: Provisional Offer of Internship / Project Work Training at ADA, Bengaluru - Reg.', {
    x: 50,
    y,
    size: 10,
    font: fontBold,
    color: NAVY,
  });
  y -= 25;

  page.drawText('Dear Candidate,', { x: 50, y, size: 9, font, color: DARK });
  y -= 18;

  const letterBody = [
    `With reference to your application No. ${data.applicationNo || 'N/A'} recommended by your institution, we are pleased to offer you provisional admission to undergo ${data.level || 'Internship'} Training at the Aeronautical Development Agency (ADA), Bengaluru, on the following terms:`,
    `1. Assigned Directorate: ${data.directorateName || 'ADA Technical Directorate'}`,
    `2. Designated Guide: ${data.guideName || 'Designated Guide'}`,
    `3. Approved Duration: ${data.durationWeeks ?? 16} Weeks`,
    `4. Scheduled Reporting Date: ${data.reportingDate || 'To be scheduled'}`,
  ];

  for (const p of letterBody) {
    page.drawText(p, { x: 50, y, size: 9, font: p.startsWith('With') ? font : fontBold, color: DARK });
    y -= 18;
  }

  y -= 10;
  page.drawText('IMPORTANT REPORTING INSTRUCTIONS & SECURITY PROTOCOLS:', {
    x: 50,
    y,
    size: 9,
    font: fontBold,
    color: NAVY,
  });
  y -= 16;

  const instructions = [
    '• Reporting Venue: Security Reception, ADA, Vimanapura Post, Bengaluru at 09:00 hrs on the reporting date.',
    '• Mandatory Documents: Valid Photo ID proof (Original Aadhaar / Voter ID), College ID card, 2 passport photos, Police Verification / Conduct Certificate.',
    '• Electronic Gadgets: Mobile phones with cameras, laptops, USB pen drives and external storage media are strictly prohibited inside ADA technical premises.',
    '• Stipend & Accommodation: As per Govt. of India / DRDO policy, no stipend, travel allowance or hostel accommodation is provided.',
    '• 100% Attendance: Mandatory for issuance of the completion certificate at the end of the training tenure.',
  ];

  for (const ins of instructions) {
    page.drawText(ins, { x: 50, y, size: 8, font, color: DARK, maxWidth: 490, lineHeight: 11 });
    y -= 18;
  }

  y -= 25;
  page.drawText('Yours faithfully,', { x: 400, y, size: 9, font, color: DARK });
  y -= 40;
  page.drawText('Senior Administrative Officer (Admin & HR)', { x: 330, y, size: 9, font: fontBold, color: NAVY });
  y -= 13;
  page.drawText('Aeronautical Development Agency, Bengaluru', { x: 330, y, size: 8.5, font, color: SLATE });

  return doc.save();
}

/**
 * Official Certificate of Completion with embedded QR Code.
 */
export async function generateCertificatePdf(data: CertificatePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // Landscape A4: 841.89 x 595.28
  const width = 841.89;
  const height = 595.28;
  const page = doc.addPage([width, height]);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Generate QR Code as PNG buffer
  const qrDataUrl = await QRCode.toDataURL(data.verifyUrl, {
    margin: 1,
    width: 140,
    color: { dark: '#0a192f', light: '#ffffff' },
  });
  const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  const qrImage = await doc.embedPng(Buffer.from(qrBase64, 'base64'));

  // Outer border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: NAVY,
    borderWidth: 3,
  });

  // Inner border
  page.drawRectangle({
    x: 26,
    y: 26,
    width: width - 52,
    height: height - 52,
    borderColor: rgb(0.85, 0.7, 0.35), // Gold accent
    borderWidth: 1.5,
  });

  let y = 530;

  // Header
  page.drawText('AERONAUTICAL DEVELOPMENT AGENCY', {
    x: width / 2 - 180,
    y,
    size: 18,
    font: fontBold,
    color: NAVY,
  });
  y -= 18;
  page.drawText('MINISTRY OF DEFENCE, GOVERNMENT OF INDIA', {
    x: width / 2 - 150,
    y,
    size: 11,
    font: fontBold,
    color: SLATE,
  });
  y -= 14;
  page.drawText('P.B. No. 1718, Vimanapura Post, Bengaluru - 560 017', {
    x: width / 2 - 130,
    y,
    size: 9.5,
    font,
    color: SLATE,
  });
  y -= 30;

  // Certificate Title
  page.drawText('CERTIFICATE OF COMPLETION', {
    x: width / 2 - 150,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.75, 0.55, 0.15), // Deep Gold
  });
  y -= 18;

  // Serial Number
  page.drawText(`Serial No: ${data.serialNo}`, {
    x: width / 2 - 60,
    y,
    size: 9.5,
    font: fontBold,
    color: DARK,
  });
  y -= 35;

  // Body
  page.drawText('This is to certify that Mr. / Ms.', {
    x: 120,
    y,
    size: 12,
    font,
    color: DARK,
  });
  page.drawText(data.traineeName || 'Trainee', {
    x: 295,
    y: y - 1,
    size: 13.5,
    font: fontBold,
    color: NAVY,
  });
  y -= 24;

  const collegeText = `student of ${data.collegeName || 'Accredited Institution'}, pursuing ${data.degree || 'Degree'} in ${data.discipline || 'Engineering'},`;
  page.drawText(collegeText, {
    x: 120,
    y,
    size: 11,
    font,
    color: DARK,
  });
  y -= 24;

  page.drawText('has successfully completed the project work / internship training titled:', {
    x: 120,
    y,
    size: 11,
    font,
    color: DARK,
  });
  y -= 24;

  // Topic highlight
  page.drawText(`"${data.topic || 'Project Work'}"`, {
    x: 140,
    y,
    size: 12,
    font: fontBold,
    color: NAVY,
    maxWidth: 580,
  });
  y -= 28;

  const directorateText = `in the Directorate of ${data.directorateName || 'ADA Technical Directorate'}, under the project guidance of ${data.guideName || 'Designated Guide'},`;
  page.drawText(directorateText, {
    x: 120,
    y,
    size: 11,
    font,
    color: DARK,
  });
  y -= 24;

  const datesText = `from ${data.startDate || 'start'} to ${data.endDate || 'completion'}. During the training period, conduct and attendance were SATISFACTORY.`;
  page.drawText(datesText, {
    x: 120,
    y,
    size: 11,
    font,
    color: DARK,
  });
  y -= 45;

  // QR Code on bottom left
  page.drawImage(qrImage, {
    x: 70,
    y: 50,
    width: 80,
    height: 80,
  });

  page.drawText('Scan QR to verify authenticity', {
    x: 55,
    y: 40,
    size: 7.5,
    font: fontBold,
    color: NAVY,
  });
  page.drawText(`Issued on: ${new Date(data.issuedAt || Date.now()).toLocaleDateString()}`, {
    x: 55,
    y: 30,
    size: 7.5,
    font,
    color: SLATE,
  });

  // Signatures on bottom right
  const sigY = 95;
  // Guide
  page.drawText(data.guideName || 'Project Guide', { x: 260, y: sigY, size: 9.5, font: fontBold, color: DARK });
  page.drawText('Project Guide', { x: 260, y: sigY - 12, size: 8.5, font, color: SLATE });
  page.drawText(`Dir. of ${data.directorateName || 'ADA'}`, { x: 260, y: sigY - 24, size: 8, font, color: SLATE });

  // Directorate Head
  page.drawText('Head of Directorate', { x: 450, y: sigY, size: 9.5, font: fontBold, color: DARK });
  page.drawText('Aeronautical Development Agency', { x: 450, y: sigY - 12, size: 8.5, font, color: SLATE });
  page.drawText('Bengaluru', { x: 450, y: sigY - 24, size: 8, font, color: SLATE });

  // Director Admin & HR
  page.drawText(data.issuedBy || 'Director (Admin & HR)', { x: 640, y: sigY, size: 9.5, font: fontBold, color: NAVY });
  page.drawText('Director (Admin & HR)', { x: 640, y: sigY - 12, size: 8.5, font, color: SLATE });
  page.drawText('ADA / Ministry of Defence', { x: 640, y: sigY - 24, size: 8, font, color: SLATE });

  return doc.save();
}
