# Facebook Ad Library — ลิงก์ค้นหาโฆษณาคู่แข่ง (ประเทศไทย)

> Ad Library เปิดดูได้ฟรีไม่ต้อง login แต่ต้องเปิดผ่านเบราว์เซอร์ (เพจโหลดด้วย JavaScript ดึงอัตโนมัติจาก server ตรงๆ ไม่ได้)
> วิธีที่แม่นที่สุด: เปิดเพจคู่แข่ง → เมนู "About/เกี่ยวกับ" → "Page transparency/ความโปร่งใสของเพจ" → "Go to Ad Library" จะกรองเฉพาะโฆษณาของเพจนั้นให้เลย

## ลิงก์ค้นหาต่อแบรนด์ (active ads, ประเทศไทย)

| แบรนด์ | ลิงก์ Ad Library |
|---|---|
| Aura Bangkok Clinic | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=Aura%20Bangkok%20Clinic&search_type=keyword_unordered |
| Aura Xpress | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=Aura%20Xpress&search_type=keyword_unordered |
| Gangnam Clinic | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=%E0%B8%81%E0%B8%B1%E0%B8%87%E0%B8%99%E0%B8%B1%E0%B8%A1%E0%B8%84%E0%B8%A5%E0%B8%B4%E0%B8%99%E0%B8%B4%E0%B8%81&search_type=keyword_unordered |
| Apex (Profound Beauty) | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=Apex%20Profound%20Beauty&search_type=keyword_unordered |
| Apex Young | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=100094367245893 |
| Romrawin Clinic | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=%E0%B8%A3%E0%B8%A1%E0%B8%A2%E0%B9%8C%E0%B8%A3%E0%B8%A7%E0%B8%B4%E0%B8%99%E0%B8%97%E0%B9%8C&search_type=keyword_unordered |
| Dermatige Clinic | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&view_all_page_id=61552982295931 |
| The Demis | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=The%20Demis%20Clinic&search_type=keyword_unordered |
| DSK Clinic | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=DSK%20Clinic&search_type=keyword_unordered |
| THE KLINIQUE | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=The%20Klinique&search_type=keyword_unordered |
| L Clinic | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=L%20Clinic&search_type=keyword_unordered |
| SLC Clinic | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=SLC%20Clinic&search_type=keyword_unordered |
| Kalm Clinic | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=Kalm%20Clinic&search_type=keyword_unordered |
| V Square Clinic | https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=TH&q=V%20Square%20Clinic&search_type=keyword_unordered |

หมายเหตุ: แบรนด์ที่รู้ page ID แล้ว (Apex Young, Dermatige) ใช้ `view_all_page_id` ซึ่งแม่นกว่า keyword — แบรนด์อื่นเมื่อเปิดเจอเพจแล้วให้กดเข้าโฆษณาของเพจนั้น แล้วบันทึก page ID จาก URL กลับมาใส่ตารางนี้

## สิ่งที่ควรบันทึกจาก Ad Library ลง `data/ads.csv`

- จำนวนโฆษณา active ทั้งหมดของเพจ (บอกระดับการอัดงบได้คร่าวๆ)
- วันเริ่มรันของแต่ละชิ้น (ชิ้นที่รันนานหลายเดือน = winning creative)
- ข้อความ hook / ราคา / โปรที่ใช้ในแอด
- รูปแบบครีเอทีฟ (วิดีโอรีวิว, before-after, ราคาแปะหน้า, ดารา/influencer)
- แลนดิ้ง (LINE OA, เว็บไซต์, ฟอร์ม, Messenger)
- มีหลายเวอร์ชันของแอดเดียวกันไหม (A/B testing)

> หมายเหตุด้านกติกา: หมวด "ความงาม/สุขภาพ" ไม่ใช่หมวดที่ Facebook เปิดเผยงบและ reach ต่อชิ้น (เปิดเฉพาะ ads เกี่ยวกับการเมือง/ประเด็นสังคม) จึงดูได้เพียงจำนวนชิ้น ระยะเวลา และครีเอทีฟ
