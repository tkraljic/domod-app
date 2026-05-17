-- Readable views for ad-hoc DB inspection (WebStorm SQL console).
-- These are *views*, not tables — they auto-update when underlying data changes.
-- Prisma ignores views in introspection so they don't conflict with the schema.
-- Postgres is case-sensitive: Prisma-created tables/columns must be double-quoted.

DROP VIEW IF EXISTS "DeliveryReadable";
CREATE VIEW "DeliveryReadable" AS
SELECT
  d.id,
  d.date::date                         AS dan,
  d."sequenceNumber"                   AS broj,
  CASE d.channel
    WHEN 'branch' THEN 'Poslovnica'
    WHEN 'web'    THEN 'Web'
    ELSE d.channel
  END                                  AS kanal,
  CASE d.status
    WHEN 'planned'     THEN 'Planirano'
    WHEN 'in_transit'  THEN 'U prevozu'
    WHEN 'delivered'   THEN 'Isporučeno'
    WHEN 'failed'      THEN 'Neuspjelo'
    WHEN 'rescheduled' THEN 'Preraspoređeno'
    ELSE d.status
  END                                  AS status,
  b.code                               AS poslovnica_kod,
  b.name                               AS poslovnica,
  v.name                               AS vozilo,
  drv."fullName"                       AS vozac,
  d."customerName"                     AS kupac,
  d."customerAddress"                  AS adresa,
  d."customerPhone"                    AS telefon,
  d."deliveryTime"                     AS termin,
  d."crewSizeRequired"                 AS posada,
  d."carryInRequired"                  AS unos,
  d.latitude                           AS lat,
  d.longitude                          AS lng,
  d.notes                              AS napomena,
  cu."fullName"                        AS kreirao,
  uu."fullName"                        AS azurirao,
  d."createdAt",
  d."updatedAt"
FROM "Delivery" d
LEFT JOIN "Branch"  b   ON d."branchId"    = b.id
LEFT JOIN "Vehicle" v   ON d."vehicleId"   = v.id
LEFT JOIN "User"    drv ON d."driverId"    = drv.id
LEFT JOIN "User"    cu  ON d."createdById" = cu.id
LEFT JOIN "User"    uu  ON d."updatedById" = uu.id;

DROP VIEW IF EXISTS "DeliveryItemReadable";
CREATE VIEW "DeliveryItemReadable" AS
SELECT
  di.id,
  d.date::date         AS dan,
  d."sequenceNumber"   AS broj,
  d."customerName"     AS kupac,
  p.sku,
  p."nameBs"           AS artikl,
  di.quantity          AS kolicina,
  p."weightKg"         AS tezina_kom,
  (p."weightKg" * di.quantity) AS tezina_ukupno,
  di.notes             AS napomena
FROM "DeliveryItem" di
JOIN "Delivery" d ON di."deliveryId" = d.id
JOIN "Product"  p ON di."productId"  = p.id;

DROP VIEW IF EXISTS "AuditLogReadable";
CREATE VIEW "AuditLogReadable" AS
SELECT
  a.id,
  a."createdAt"      AS vrijeme,
  u."fullName"       AS korisnik,
  a."entityType"     AS entitet,
  CASE a.action
    WHEN 'create' THEN 'Kreirano'
    WHEN 'update' THEN 'Ažurirano'
    WHEN 'delete' THEN 'Obrisano'
    ELSE a.action
  END                AS akcija,
  a."entityId",
  a.changes
FROM "AuditLog" a
JOIN "User" u ON a."userId" = u.id;
