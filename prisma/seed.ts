import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ─── Admin user ────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { email: 'admin@domod.ba' },
    update: {},
    create: {
      email: 'admin@domod.ba',
      passwordHash: adminHash,
      fullName: 'Administrator',
      role: 'admin',
    },
  })

  const plannerHash = await bcrypt.hash('planer123', 12)
  await prisma.user.upsert({
    where: { email: 'planer@domod.ba' },
    update: {},
    create: {
      email: 'planer@domod.ba',
      passwordHash: plannerHash,
      fullName: 'Planer Dostava',
      role: 'planner',
    },
  })

  // ─── Drivers (vozači) ──────────────────────────────────────────────────────
  const driverHash = await bcrypt.hash('vozac123', 12)
  const drivers = [
    { email: 'edin.hasanovic@domod.ba', fullName: 'Edin Hasanović' },
    { email: 'mirsad.begic@domod.ba', fullName: 'Mirsad Begić' },
    { email: 'adnan.mehmedovic@domod.ba', fullName: 'Adnan Mehmedović' },
    { email: 'senad.kovacevic@domod.ba', fullName: 'Senad Kovačević' },
    { email: 'haris.delic@domod.ba', fullName: 'Haris Delić' },
  ]

  for (const d of drivers) {
    await prisma.user.upsert({
      where: { email: d.email },
      update: {},
      create: {
        email: d.email,
        passwordHash: driverHash,
        fullName: d.fullName,
        role: 'driver',
      },
    })
  }

  // ─── Branches ──────────────────────────────────────────────────────────────
  const branches = [
    { code: 'SRJ', name: 'Sarajevo', address: 'Sarajevo', sortOrder: 1 },
    { code: 'MOS', name: 'Mostar', address: 'Mostar', sortOrder: 2 },
    { code: 'TUZ', name: 'Tuzla', address: 'Tuzla', sortOrder: 3 },
    { code: 'BAN', name: 'Banja Luka', address: 'Banja Luka', sortOrder: 4 },
    { code: 'WEB', name: 'Web narudžbe', isWeb: true, sortOrder: 99 },
  ]

  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { code: branch.code },
      update: {},
      create: branch,
    })
  }

  // ─── Product categories ────────────────────────────────────────────────────
  const rootCategories = [
    { nameBs: 'Bijela tehnika', nameEn: 'White goods', sortOrder: 1 },
    { nameBs: 'TV i audio', nameEn: 'TV & audio', sortOrder: 2 },
    { nameBs: 'Mobilna telefonija', nameEn: 'Mobile phones', sortOrder: 3 },
    { nameBs: 'Mali kućanski aparati', nameEn: 'Small appliances', sortOrder: 4 },
    { nameBs: 'Računari i IT', nameEn: 'Computers & IT', sortOrder: 5 },
    { nameBs: 'Ostalo', nameEn: 'Other', sortOrder: 99 },
  ]

  const createdRoots: Record<string, string> = {}

  for (const cat of rootCategories) {
    const existing = await prisma.productCategory.findFirst({
      where: { nameBs: cat.nameBs, parentId: null },
    })
    if (existing) {
      createdRoots[cat.nameBs] = existing.id
    } else {
      const created = await prisma.productCategory.create({ data: cat })
      createdRoots[cat.nameBs] = created.id
    }
  }

  const subCategories: Array<{ nameBs: string; nameEn?: string; parentKey: string; sortOrder: number }> = [
    { nameBs: 'Frižideri', nameEn: 'Refrigerators', parentKey: 'Bijela tehnika', sortOrder: 1 },
    { nameBs: 'Mašine za pranje', nameEn: 'Washing machines', parentKey: 'Bijela tehnika', sortOrder: 2 },
    { nameBs: 'Sušilice', nameEn: 'Dryers', parentKey: 'Bijela tehnika', sortOrder: 3 },
    { nameBs: 'Mašine za suđe', nameEn: 'Dishwashers', parentKey: 'Bijela tehnika', sortOrder: 4 },
    { nameBs: 'Šporeti', nameEn: 'Cookers', parentKey: 'Bijela tehnika', sortOrder: 5 },
    { nameBs: 'Televizori', nameEn: 'Televisions', parentKey: 'TV i audio', sortOrder: 1 },
    { nameBs: 'Soundbars', nameEn: 'Soundbars', parentKey: 'TV i audio', sortOrder: 2 },
    { nameBs: 'Pametni telefoni', nameEn: 'Smartphones', parentKey: 'Mobilna telefonija', sortOrder: 1 },
    { nameBs: 'Tableti', nameEn: 'Tablets', parentKey: 'Mobilna telefonija', sortOrder: 2 },
    { nameBs: 'Aparati za kafu', nameEn: 'Coffee machines', parentKey: 'Mali kućanski aparati', sortOrder: 1 },
    { nameBs: 'Usisavači', nameEn: 'Vacuum cleaners', parentKey: 'Mali kućanski aparati', sortOrder: 2 },
    { nameBs: 'Klima uređaji', nameEn: 'Air conditioners', parentKey: 'Mali kućanski aparati', sortOrder: 3 },
    { nameBs: 'Laptopi', nameEn: 'Laptops', parentKey: 'Računari i IT', sortOrder: 1 },
    { nameBs: 'Desktop računari', nameEn: 'Desktop computers', parentKey: 'Računari i IT', sortOrder: 2 },
  ]

  for (const sub of subCategories) {
    const parentId = createdRoots[sub.parentKey]
    const existing = await prisma.productCategory.findFirst({
      where: { nameBs: sub.nameBs, parentId },
    })
    if (!existing) {
      await prisma.productCategory.create({
        data: { nameBs: sub.nameBs, nameEn: sub.nameEn, parentId, sortOrder: sub.sortOrder },
      })
    }
  }

  // ─── Vehicles ──────────────────────────────────────────────────────────────
  const vehicles = [
    { name: 'Kombi 1', payloadKg: 1000, volumeM3: 8 },
    { name: 'Kombi 2', payloadKg: 1000, volumeM3: 8 },
    { name: 'Kamion 1', payloadKg: 3500, volumeM3: 20 },
  ]

  for (const v of vehicles) {
    const existing = await prisma.vehicle.findFirst({ where: { name: v.name } })
    if (!existing) {
      await prisma.vehicle.create({ data: v })
    }
  }

  // ─── Sample products ───────────────────────────────────────────────────────
  async function catId(nameBs: string) {
    const cat = await prisma.productCategory.findFirst({ where: { nameBs } })
    if (!cat) throw new Error(`Kategorija nije pronađena: ${nameBs}`)
    return cat.id
  }

  const sampleProducts = [
    {
      sku: 'LG-F4V5-9KG',
      nameBs: 'LG mašina za pranje F4V5 9kg',
      nameEn: 'LG Washing Machine F4V5 9kg',
      categoryId: await catId('Mašine za pranje'),
      brand: 'LG',
      supplier: 'LG Bosnia',
      lengthCm: 60,
      widthCm: 60,
      heightCm: 85,
      weightKg: 70,
      carryInDefault: true,
      crewSizeDefault: 2,
    },
    {
      sku: 'BOSCH-SMS4-14',
      nameBs: 'Bosch mašina za suđe SMS4 14 setova',
      nameEn: 'Bosch Dishwasher SMS4 14 settings',
      categoryId: await catId('Mašine za suđe'),
      brand: 'Bosch',
      supplier: 'Bosch BH',
      lengthCm: 60,
      widthCm: 60,
      heightCm: 85,
      weightKg: 52,
      carryInDefault: true,
      crewSizeDefault: 2,
    },
    {
      sku: 'SAMSUNG-RB34',
      nameBs: 'Samsung frižider RB34 combi',
      nameEn: 'Samsung Fridge RB34 combi',
      categoryId: await catId('Frižideri'),
      brand: 'Samsung',
      supplier: 'Samsung Adriatic',
      lengthCm: 60,
      widthCm: 66,
      heightCm: 185,
      weightKg: 80,
      carryInDefault: true,
      crewSizeDefault: 2,
    },
    {
      sku: 'SAMSUNG-QE55',
      nameBs: 'Samsung QLED TV 55"',
      nameEn: 'Samsung QLED TV 55"',
      categoryId: await catId('Televizori'),
      brand: 'Samsung',
      lengthCm: 123,
      widthCm: 8,
      heightCm: 71,
      weightKg: 18,
      carryInDefault: false,
      crewSizeDefault: 1,
    },
    {
      sku: 'LG-OLED65',
      nameBs: 'LG OLED TV 65"',
      nameEn: 'LG OLED TV 65"',
      categoryId: await catId('Televizori'),
      brand: 'LG',
      lengthCm: 145,
      widthCm: 7,
      heightCm: 83,
      weightKg: 25,
      carryInDefault: false,
      crewSizeDefault: 2,
    },
    {
      sku: 'APPLE-IP15-128',
      nameBs: 'iPhone 15 128GB',
      nameEn: 'iPhone 15 128GB',
      categoryId: await catId('Pametni telefoni'),
      brand: 'Apple',
      supplier: 'iSTYLE',
      weightKg: 0.17,
      carryInDefault: false,
      crewSizeDefault: 1,
    },
    {
      sku: 'APPLE-IP15P-256',
      nameBs: 'iPhone 15 Pro 256GB',
      nameEn: 'iPhone 15 Pro 256GB',
      categoryId: await catId('Pametni telefoni'),
      brand: 'Apple',
      supplier: 'iSTYLE',
      weightKg: 0.19,
      carryInDefault: false,
      crewSizeDefault: 1,
    },
    {
      sku: 'DELONGHI-ECAM',
      nameBs: 'DeLonghi aparat za kafu ECAM',
      nameEn: 'DeLonghi Coffee Machine ECAM',
      categoryId: await catId('Aparati za kafu'),
      brand: 'DeLonghi',
      lengthCm: 24,
      widthCm: 36,
      heightCm: 35,
      weightKg: 9,
      carryInDefault: false,
      crewSizeDefault: 1,
    },
    {
      sku: 'DYSON-V15',
      nameBs: 'Dyson usisavač V15 Detect',
      nameEn: 'Dyson Vacuum V15 Detect',
      categoryId: await catId('Usisavači'),
      brand: 'Dyson',
      lengthCm: 26,
      widthCm: 25,
      heightCm: 126,
      weightKg: 3,
      carryInDefault: false,
      crewSizeDefault: 1,
    },
    {
      sku: 'MIDEA-AC-12',
      nameBs: 'Midea klima 12000 BTU',
      nameEn: 'Midea AC 12000 BTU',
      categoryId: await catId('Klima uređaji'),
      brand: 'Midea',
      supplier: 'Midea BH',
      lengthCm: 80,
      widthCm: 30,
      heightCm: 22,
      weightKg: 12,
      carryInDefault: true,
      crewSizeDefault: 2,
      notes: 'Potrebna instalacija — zasebna usluga.',
    },
    {
      sku: 'HP-PAV-15',
      nameBs: 'HP Pavilion 15 laptop',
      nameEn: 'HP Pavilion 15 laptop',
      categoryId: await catId('Laptopi'),
      brand: 'HP',
      lengthCm: 36,
      widthCm: 24,
      heightCm: 2,
      weightKg: 1.8,
      carryInDefault: false,
      crewSizeDefault: 1,
    },
    {
      sku: 'GORENJE-BC3',
      nameBs: 'Gorenje šporet BC3',
      nameEn: 'Gorenje Cooker BC3',
      categoryId: await catId('Šporeti'),
      brand: 'Gorenje',
      lengthCm: 60,
      widthCm: 60,
      heightCm: 85,
      weightKg: 45,
      carryInDefault: true,
      crewSizeDefault: 2,
    },
  ]

  for (const p of sampleProducts) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    })
  }

  console.log('✅ Seed completed')
  console.log('  → Korisnici: admin@domod.ba / admin123, planer@domod.ba / planer123')
  console.log('  → Poslovnice: SRJ, MOS, TUZ, BAN, WEB')
  console.log('  → Kategorije: 6 root + 14 pod-kategorija')
  console.log('  → Vozila: 2 kombija + 1 kamion')
  console.log(`  → Artikli: ${sampleProducts.length} uzoraka`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
