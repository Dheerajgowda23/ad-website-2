-- College particulars the candidate must supply: the recommendation letter,
-- offer letter and certificate all print the institution, which was previously
-- hardcoded as "Accredited Institution".
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "college_name" TEXT,
  ADD COLUMN IF NOT EXISTS "university_name" TEXT,
  ADD COLUMN IF NOT EXISTS "roll_number" TEXT,
  ADD COLUMN IF NOT EXISTS "college_address" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT;
