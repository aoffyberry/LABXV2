# Competitor Social Listening — คลินิกความงาม

ระบบเก็บและวิเคราะห์ข้อมูลคู่แข่ง 14 แบรนด์ จาก 3 แหล่ง: **Facebook Ad Library**, **mention จากเครื่องมือ listening**, และ **โพสต์สาธารณะของเพจคู่แข่ง**

## โครงสร้าง

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `competitors.csv` | Master list คู่แข่ง: ลิงก์ FB/IG, follower, positioning |
| `ad-library-links.md` | ลิงก์เปิด Ad Library ตรงต่อแบรนด์ + checklist สิ่งที่ต้องบันทึก |
| `data/ads.csv` | บันทึกโฆษณาจาก Ad Library (1 แถว = 1 ชิ้นแอด) |
| `data/mentions.csv` | บันทึก mention จากเครื่องมือ listening / Pantip / TikTok / ข่าว |
| `data/posts.csv` | บันทึกโพสต์สาธารณะของเพจคู่แข่ง + engagement |
| `reports/` | รายงานสรุปรายเดือน (ล่าสุด: `2026-07-competitor-social-listening.md`) |

## วิธีเก็บข้อมูล (รอบแนะนำ: ทุก 2 สัปดาห์)

### 1. Ad Library
เปิดลิงก์ใน `ad-library-links.md` → บันทึกลง `data/ads.csv`
โฟกัส: จำนวนแอด active, แอดที่รันนาน (winning creative), ราคา/hook ที่ใช้, แลนดิ้ง (LINE OA vs เว็บ)

### 2. Mentions
- เครื่องมือ listening (Wisesight ZOCIAL EYE / Mandala / Zanroo — ตั้ง keyword: ชื่อแบรนด์ไทย+อังกฤษ, ชื่อหมอ, ชื่อสาขา, คำผันดราม่า)
- เก็บมือเสริมจาก: Pantip (search ชื่อแบรนด์), TikTok discover, Wongnai, ข่าว (khaosod/dailynews/thaiger)
- บันทึกลง `data/mentions.csv` พร้อม sentiment (positive/neutral/negative) และ topic (โปร, ผลลัพธ์, บริการ, hard-sell, ดราม่า)

### 3. โพสต์เพจคู่แข่ง
ไล่หน้าเพจ FB/IG ย้อนหลัง 2 สัปดาห์ → บันทึกลง `data/posts.csv`
โฟกัส: content pillar (โปร/รีวิว/ให้ความรู้/อีเวนต์/KOL), หัตถการที่ดัน, กลไกโปร, engagement เทียบค่าเฉลี่ยเพจ

## หมายเหตุ
- Ad Library หมวดความงามไม่เปิดเผยงบ/reach ต่อชิ้น — ประเมินระดับการอัดงบจากจำนวนชิ้น × ระยะเวลารัน
- follower ใน `competitors.csv` อัปเดตเมื่อ ก.ค. 2026 — ควร snapshot ทุกเดือนเพื่อดู growth rate
