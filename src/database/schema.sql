-- =====================================================
-- REACTED_CHECKS DATABASE SCHEMA (TypeScript Version)
-- Edit_checks loyihasi bilan bir xil mantiq
-- =====================================================

-- UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1️⃣ CHECKS TABLE (Cheklar jadvali)
-- =====================================================
CREATE TABLE IF NOT EXISTS checks (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    chek_raqam VARCHAR(100) NOT NULL,
    chek_summa DECIMAL(15, 2) NOT NULL,
    maxsulot_nomi TEXT,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2️⃣ FAKTURA TABLE (Fakturalar jadvali)
-- ✅ Takroriy qatorlar mumkin (UNIQUE yo'q)
-- =====================================================
CREATE TABLE IF NOT EXISTS faktura (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    mxik VARCHAR(100) NOT NULL,
    ulchov VARCHAR(500) NOT NULL,
    faktura_summa DECIMAL(15, 2) NOT NULL,
    faktura_miqdor DECIMAL(15, 8) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 3️⃣ SELECT_CHECKS TABLE (Hisob-kitoblar)
-- =====================================================
CREATE TABLE IF NOT EXISTS select_checks (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    
    -- Faktura ma'lumotlari
    mxik VARCHAR(100) NOT NULL,
    ulchov VARCHAR(500) NOT NULL,
    faktura_summa DECIMAL(15, 2) NOT NULL,
    faktura_miqdor DECIMAL(15, 8) NOT NULL,
    
    -- Chek ma'lumotlari
    chek_raqam VARCHAR(100) NOT NULL,
    maxsulot_nomi TEXT,
    chek_summa DECIMAL(15, 2) NOT NULL,
    miqdor DECIMAL(15, 8) NOT NULL,

    -- Hisoblangan qiymatlar
    umumiy_chek_summa DECIMAL(15, 2) NOT NULL,
    bir_birlik DECIMAL(15, 2) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEKSLAR (Tezkor qidiruv)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_checks_chek_raqam ON checks(chek_raqam);
CREATE INDEX IF NOT EXISTS idx_checks_processed ON checks(processed);
CREATE INDEX IF NOT EXISTS idx_checks_summa ON checks(chek_summa);

CREATE INDEX IF NOT EXISTS idx_faktura_mxik ON faktura(mxik);
CREATE INDEX IF NOT EXISTS idx_faktura_is_active ON faktura(is_active);
CREATE INDEX IF NOT EXISTS idx_faktura_summa ON faktura(faktura_summa);
CREATE INDEX IF NOT EXISTS idx_faktura_mxik_ulchov ON faktura(mxik, ulchov);

CREATE INDEX IF NOT EXISTS idx_select_checks_mxik ON select_checks(mxik);
CREATE INDEX IF NOT EXISTS idx_select_checks_chek ON select_checks(chek_raqam);
CREATE INDEX IF NOT EXISTS idx_select_checks_active ON select_checks(is_active);

-- =====================================================
-- TRIGGER: updated_at avtomatik yangilash
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $BODY$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$BODY$ LANGUAGE plpgsql;

-- Checks uchun trigger
DROP TRIGGER IF EXISTS trg_update_checks_updated_at ON checks;
CREATE TRIGGER trg_update_checks_updated_at
BEFORE UPDATE ON checks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Faktura uchun trigger
DROP TRIGGER IF EXISTS trg_update_faktura_updated_at ON faktura;
CREATE TRIGGER trg_update_faktura_updated_at
BEFORE UPDATE ON faktura
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Select_checks uchun trigger
DROP TRIGGER IF EXISTS trg_update_select_checks_updated_at ON select_checks;
CREATE TRIGGER trg_update_select_checks_updated_at
BEFORE UPDATE ON select_checks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEW: Statistika
-- =====================================================
DROP VIEW IF EXISTS statistics;

CREATE VIEW statistics AS
SELECT 
    -- Cheklar
    (SELECT COUNT(*) FROM checks) as total_checks,
    (SELECT COUNT(*) FROM checks WHERE processed = false) as unprocessed_checks,
    (SELECT COUNT(*) FROM checks WHERE processed = true) as processed_checks,
    
    -- Fakturalar
    (SELECT COUNT(*) FROM faktura) as total_fakturas,
    (SELECT COUNT(*) FROM faktura WHERE is_active = true) as active_fakturas,
    (SELECT COUNT(*) FROM faktura WHERE is_active = false) as inactive_fakturas,
    
    -- Select_checks
    (SELECT COUNT(*) FROM select_checks) as total_select_checks,
    (SELECT COUNT(*) FROM select_checks WHERE is_active = true) as active_select_checks,
    (SELECT COUNT(*) FROM select_checks WHERE is_active = false) as inactive_select_checks,
    
    -- Summalar
    (SELECT SUM(chek_summa) FROM checks) as total_checks_summa,
    (SELECT SUM(chek_summa) FROM checks WHERE processed = false) as total_unprocessed_summa,
    (SELECT SUM(chek_summa) FROM checks WHERE processed = true) as total_processed_summa,
    (SELECT SUM(umumiy_chek_summa) FROM select_checks) as total_selected_summa,
    (SELECT SUM(faktura_summa) FROM faktura WHERE is_active = true) as total_active_faktura_summa;