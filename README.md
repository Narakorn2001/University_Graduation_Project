# Firebase Firestore CRUD (Vanilla HTML/CSS/JS)

## ตั้งค่าอย่างย่อ

1. ไปที่ Firebase Console สร้างโปรเจกต์ และเปิดใช้งาน Firestore (โหมดทดสอบระหว่างพัฒนา)
2. ไปที่ Project settings > Your apps > เว็บ (</>) แล้วคัดลอกค่า config ของเว็บแอป
3. เปิดไฟล์ `app.js` แล้วแทนที่ค่าในตัวแปร `firebaseConfig` ด้วยค่าจากข้อ 2
4. เปิด `index.html` ในเบราว์เซอร์ หรือรันผ่าน local server ก็ได้

## ไฟล์สำคัญ

- `index.html` — ส่วนติดต่อผู้ใช้ (ฟอร์ม + รายการแบบเรียลไทม์)
- `styles.css` — สไตล์
- `app.js` — เชื่อมต่อ Firestore และทำ CRUD (Create/Read/Update/Delete)

## โครงสร้างข้อมูล (คอลเลกชัน `items`)

- `name`: string
- `description`: string
- `createdAt`: serverTimestamp
- `updatedAt`: serverTimestamp

## การใช้งาน

- กรอกชื่อ/รายละเอียด แล้วกด “บันทึก” เพื่อสร้างข้อมูล
- คลิก “แก้ไข” เพื่อโหลดค่ามาแก้ แล้วกด “อัปเดต”
- คลิก “ลบ” เพื่อลบรายการนั้น
- รายการจะอัปเดตแบบเรียลไทม์ด้วย onSnapshot

## Firestore Security Rules

ช่วงพัฒนา (Dev/Test) อาจเปิดง่าย ๆ ชั่วคราว:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // DEV ONLY
    }
  }
}
```

สำหรับโปรดักชัน ควรกำหนดให้อ่าน/เขียนได้เฉพาะผู้ที่ผ่านการยืนยันตัวตน:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

ปรับปรุงให้เหมาะกับแบบจำลองสิทธิ์ของระบบคุณ
