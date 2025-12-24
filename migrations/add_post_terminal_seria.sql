-- Faktura table'ga post_terminal_seria ustunini qo'shish
ALTER TABLE faktura
ADD COLUMN IF NOT EXISTS post_terminal_seria VARCHAR(100) DEFAULT '';

-- Select_checks table'ga ham qo'shish
ALTER TABLE select_checks
ADD COLUMN IF NOT EXISTS post_terminal_seria VARCHAR(100) DEFAULT '';

-- Yangi ustun uchun index qo'shish
CREATE INDEX IF NOT EXISTS idx_faktura_post_terminal ON faktura(post_terminal_seria);
CREATE INDEX IF NOT EXISTS idx_select_checks_post_terminal ON select_checks(post_terminal_seria);

-- Yangi ustun uchun creation_data_faktura qo'shish (select_checks'da)
ALTER TABLE select_checks
ADD COLUMN IF NOT EXISTS creation_data_faktura VARCHAR(50) DEFAULT '';
