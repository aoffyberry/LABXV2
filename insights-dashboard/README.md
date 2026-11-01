# LABX × ปักปากกา — Insights Dashboard

Dashboard ไฟล์เดียว (`index.html`) ดึงข้อมูลจาก Facebook Graph API / Instagram Graph API / Marketing API ตรงจากเบราว์เซอร์
ไม่ต้องติดตั้งหรือ build อะไร — เปิดไฟล์ในเบราว์เซอร์ได้เลย (หรือ host บน GitHub Pages / เว็บภายใน)

> Token ไม่ถูกส่งไปที่ไหนนอกจาก `graph.facebook.com` · ถ้าติ๊ก "จำ token" จะเก็บใน localStorage ของเครื่องนั้นเท่านั้น

## วิธีใช้

1. เปิด `index.html` → วาง **Access Token** → กด **เชื่อมต่อ**
   - ระบบจะดึงรายชื่อเพจจาก `me/accounts` (และ IG ที่ผูกไว้) และบัญชีโฆษณาจาก `me/adaccounts`
   - เพจที่ชื่อตรงกับ `LABX` / `ปักปากกา` จะถูกเลือกให้อัตโนมัติ
2. เลือกเพจ, บัญชีโฆษณา, ช่วงวันที่ → **โหลดข้อมูล**
3. ปุ่ม **ใช้ข้อมูลตัวอย่าง** ใช้ดูหน้าตา dashboard โดยไม่ต้องมี token

### Token ที่แนะนำ
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
- เพจที่มีโพสต์เยอะ + ช่วงวันที่ยาว จะโหลดนาน (insights ดึงทีละโพสต์ แบบขนาน 6 request)

## Deploy บน Netlify
`netlify.toml` ที่ root ของ repo ตั้งค่าให้แล้ว (publish โฟลเดอร์ `insights-dashboard`, ไม่มี build step)
- **ผ่าน Git**: Netlify → Add new site → Import from GitHub → เลือก repo นี้ + branch → Deploy (ค่าอ่านจาก `netlify.toml` เอง)
- **CLI**: `npx netlify-cli deploy --prod` (รันที่ root ของ repo)
- Header `Content-Security-Policy` อนุญาตให้หน้าเว็บส่ง request ไปได้แค่ `graph.facebook.com` → token ไม่หลุดไปโดเมนอื่น แม้มีสคริปต์แปลกปลอม
- เว็บเป็น public URL (ใครมีลิงก์ก็เปิดได้ แต่ไม่มีข้อมูลจนกว่าจะใส่ token) ถ้าต้องการล็อกเพิ่ม ใช้ Netlify Password Protection / Basic Auth (แพ็กเกจ Pro)
