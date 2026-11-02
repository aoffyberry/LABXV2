# LABX × ปักปากกา — Insights Dashboard

Dashboard สำหรับ Facebook Page + Instagram + Ads ของ LABX และ ปักปากกา มี 2 โหมด

| โหมด | ทำงานอย่างไร | ใช้เมื่อ |
|---|---|---|
| **Snapshot (แนะนำ)** | GitHub Actions ดึง Graph API ทุกวัน → เก็บเป็นไฟล์ JSON เข้ารหัสใน `data/` → dashboard อ่านไฟล์ (ไม่เรียก API) | ดูประจำวัน, เทียบครึ่งเดือน / เต็มเดือน กับเดือนก่อน |
| **Live API** | ใส่ token แล้วดึงสดจากเบราว์เซอร์ | ต้องการช่วงวันที่เอง / ตรวจสอบข้อมูล |

## สถาปัตยกรรม (Snapshot)

```
GitHub Actions (ทุกวัน 03:17 น.)            Netlify (static)
 scripts/sync-insights.mjs                    insights-dashboard/
   ├─ Graph API (FB_GRAPH_TOKEN)               ├─ index.html  ← ใส่รหัสผ่าน → ถอดรหัสในเบราว์เซอร์
   ├─ สร้าง snapshot ต่อ period                 ├─ collect.mjs (โค้ดดึงข้อมูล ใช้ร่วมกัน)
   ├─ เข้ารหัส AES-256-GCM (DATA_PASSPHRASE)    └─ data/
   └─ commit → main ──── Netlify auto-deploy ──→    ├─ index.json      (รายการ period)
                                                   ├─ 2026-10-H1.json  (1–15 ต.ค.)
                                                   └─ 2026-10-M.json   (ทั้งเดือน ต.ค.)
```

- **Period**: `YYYY-MM-H1` = วันที่ 1–15, `YYYY-MM-M` = ทั้งเดือน (เวลาไทย)
- **ปุ่มเทียบ**: เลือกเดือน + "ครึ่งเดือน (1–15)" หรือ "เต็มเดือน" → เทียบกับช่วงเดียวกันของเดือนก่อนอัตโนมัติ (KPI + ตาราง by page พร้อม Δ%)
- **คอนเทนต์ในช่วง** = โพสต์ที่ลงในช่วงนั้น (ยอด lifetime ณ วันที่ดึง) + แอดที่วิ่งในช่วงนั้น (ยอดเฉพาะในช่วง)
- **Freeze**: period จะถูกดึงซ้ำทุกวันจนครบ **7 วันหลังจบช่วง** แล้วล็อก ไม่ดึงอีก → ทุกเดือนวัดแบบเดียวกัน (โพสต์มีเวลาเก็บยอดเท่ากัน) และไม่เปลือง API
- Job รายวันเช็ก 3 เดือนล่าสุด (เดือนนี้ + 2 เดือนก่อน) ซึ่งพอสำหรับ "เดือนก่อน vs เดือนก่อนหน้านั้น"
- ไฟล์ข้อมูลเข้ารหัส → แม้เว็บ/repo เป็น public คนที่ไม่มีรหัสผ่านก็อ่านไม่ได้

## ตั้งค่าครั้งแรก (Snapshot)

1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
   - `FB_GRAPH_TOKEN` = System User token (ดูหัวข้อ Token ด้านล่าง)
   - `DATA_PASSPHRASE` = รหัสผ่านยาว ≥ 12 ตัว (ใช้เปิดข้อมูลใน dashboard — แชร์ให้ทีมทางช่องทางที่ปลอดภัย)
   - (ไม่บังคับ) แท็บ Variables: `GRAPH_VERSION` (เช่น `v24.0`), `PAGE_MATCH` (regex ชื่อเพจ)
2. **Actions → Insights sync → Run workflow** ครั้งแรก — ใส่ `months` = 6 เพื่อ backfill ย้อนหลัง
3. Netlify ต้อง link กับ repo branch `main` เพื่อ deploy ทุกครั้งที่ job commit ข้อมูลใหม่
4. เปิดเว็บ → ใส่ `DATA_PASSPHRASE` → **เปิดข้อมูล**

ดึงใหม่เฉพาะช่วง: Run workflow → `periods` = `2026-09-H1,2026-09-M` และติ๊ก `force` ถ้าเป็นช่วงที่ freeze แล้ว
รันในเครื่อง: `FB_GRAPH_TOKEN=... DATA_PASSPHRASE=... node scripts/sync-insights.mjs`

> เปลี่ยน `DATA_PASSPHRASE` → ต้องรัน workflow แบบ `force` + `months` ครอบคลุมทุกเดือน เพื่อเข้ารหัสไฟล์เก่าใหม่
> เปิด `index.html` ตรงจากไฟล์ (file://) ไม่ได้แล้ว (ใช้ ES module) — ใช้ผ่าน Netlify หรือ `npx serve insights-dashboard`

## Live API

1. สลับเป็น **Live API** → วาง Access Token → **เชื่อมต่อ**
2. เลือกเพจ, บัญชีโฆษณา, ช่วงวันที่ → **โหลดข้อมูล**
3. ปุ่ม **ใช้ข้อมูลตัวอย่าง** ใช้ดูหน้าตา dashboard โดยไม่ต้องมี token/รหัสผ่าน

## Token ที่แนะนำ (FB_GRAPH_TOKEN)
- **System User token** จาก Business Manager (ไม่หมดอายุ) ที่ได้สิทธิ์เพจ LABX, ปักปากกา และบัญชีโฆษณา
- หรือ User token จาก [Graph API Explorer](https://developers.facebook.com/tools/explorer/) (แปลงเป็น long-lived 60 วันได้)
- Permissions: `pages_show_list`, `pages_read_engagement`, `read_insights`, `instagram_basic`, `instagram_manage_insights`, `ads_read`, `business_management`

## แท็บ

| แท็บ | แสดงอะไร |
|---|---|
| **Content Performance** | KPI หลัก Views / Engagement / ER / จำนวนคอนเทนต์ / Ad spend แยก Organic vs Paid + ตาราง breakdown by page × channel |
| **Demographics** | เลือกบัญชี (เพจ · FB/IG) และกลุ่มผู้ชม → อายุ × เพศ, Top 15 เมือง/ประเทศ + ตารางเปรียบเทียบทุกเพจ |
| **Content Ranking** | ตารางรายคอนเทนต์ Top 50 / Top 100 เรียงตาม Views / Engagement / ER, export CSV |

ตัวกรองด้านบนใช้ร่วมกันทุกแท็บ: **Channel** (ทั้งหมด / Facebook / Instagram), **Organic / Paid / รวม**, **เพจ**

## Export Excel
ปุ่ม **⬇ Export Excel** (แถบตัวกรอง) ส่งออกช่วงที่เลือกอยู่เป็น `.xlsx` (สร้างในเบราว์เซอร์ ไม่ส่งข้อมูลออกไปไหน)
- **สรุปแยกเพจ** — แต่ละเพจ × FB/IG + รวมรายเพจ + รวมทั้งหมด: คอนเทนต์, Organic/Paid Views, Organic/Paid Eng., ER, Spend, CPM, CPE และถ้าติ๊ก "เทียบกับเดือนก่อน" จะมีคอลัมน์เดือนก่อน + Δ
- **ชีตต่อเพจ** — รายคอนเทนต์เรียงตาม Total Views พร้อมลิงก์
- **Demographics** — % เพศ / ช่วงอายุ / Top 3 จังหวัด ต่อบัญชี (โหมด Snapshot)
- ใช้ตัวกรองเพจ แต่ไม่ใช้ตัวกรอง Channel / Organic-Paid (ส่งออกครบทุกช่อง)

## นิยาม metric

| Metric | Facebook | Instagram | Paid (Ads) |
|---|---|---|---|
| Views | `post_media_view` (fallback `post_impressions`) | `views` (fallback `impressions` → `reach`) | `impressions` จาก Ads Insights |
| Engagement | reactions + comments + shares | `total_interactions` (likes+comments+saves+shares) | `post_reaction` + `comment` + `post` (share) + `onsite_conversion.post_save` |

- **Paid** = Ads Insights ระดับแอด (breakdown `publisher_platform`) แล้วจับคู่กับโพสต์ผ่าน `creative.effective_object_story_id` (FB) และ `effective_instagram_media_id` (IG)
- **Organic** = ยอดรวมของโพสต์ − ส่วนที่มาจากโฆษณา (ถ้า API ให้ breakdown `is_from_ads` จะใช้ค่านั้นตรง ๆ)
- **Ad-only** = dark post หรือโพสต์ที่สร้างก่อนช่วงวันที่ แต่มีแอดวิ่งในช่วงนี้
- แอดที่วิ่ง placement Messenger / Audience Network นับรวมเป็น Facebook

## Demographics — แหล่งข้อมูล

| กลุ่มผู้ชม | Facebook | Instagram |
|---|---|---|
| Followers | `page_fans_gender_age` / `page_fans_city` (legacy — Meta ทยอยยกเลิก ถ้าดึงไม่ได้จะแจ้ง) | `follower_demographics` |
| Engaged / Reached (เดือนนี้) | – | `engaged_audience_demographics`, `reached_audience_demographics` |
| Ads audience | reach จาก Ads Insights breakdown `age,gender` และ `region`/`country` เฉพาะแอดของเพจ+ช่องทางนั้น | เหมือนกัน |

## ข้อจำกัด / หมายเหตุ
- Meta เปลี่ยนชื่อ metric บ่อย ถ้าเวอร์ชัน API เปลี่ยน ให้แก้ช่อง **API version** และดู **Log การเรียก API** ในหน้า dashboard ว่ามี metric ไหน error
- IG Stories ไม่รวม (endpoint `/media` ไม่คืน story ที่หมดอายุ)
- เพจที่มีโพสต์เยอะ + ช่วงวันที่ยาว จะโหลดนาน (insights ดึงทีละโพสต์ แบบขนาน 6 request) — ใช้โหมด Snapshot แทน; collector retry อัตโนมัติเมื่อติด rate limit
- Thumbnail ของ Facebook เป็น URL ที่มีอายุ ในข้อมูลเก่าอาจไม่แสดงรูป (ลิงก์โพสต์ยังใช้ได้)
- Demographics แบบ Followers / Engaged / Reached = ค่า ณ วันที่ดึงล่าสุดของ period นั้น

## Deploy บน Netlify
`netlify.toml` ที่ root ของ repo ตั้งค่าให้แล้ว (publish โฟลเดอร์ `insights-dashboard`, ไม่มี build step)
- **ผ่าน Git**: Netlify → Add new site → Import from GitHub → เลือก repo นี้ + branch → Deploy (ค่าอ่านจาก `netlify.toml` เอง)
- **CLI**: `npx netlify-cli deploy --prod` (รันที่ root ของ repo)
- Header `Content-Security-Policy` อนุญาตให้หน้าเว็บส่ง request ไปได้แค่โดเมนตัวเอง (ไฟล์ data) และ `graph.facebook.com` → token ไม่หลุดไปโดเมนอื่น แม้มีสคริปต์แปลกปลอม
- เว็บเป็น public URL (ใครมีลิงก์ก็เปิดได้ แต่ข้อมูลอ่านไม่ได้จนกว่าจะใส่รหัสผ่าน / token) ถ้าต้องการล็อกเพิ่ม ใช้ Netlify Password Protection / Basic Auth (แพ็กเกจ Pro)
