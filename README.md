# 🟠 OFFER ADDA (bina Node.js ke)
Sirf HTML/CSS/JS. Data, login aur live notification/chat ke liye free **Firebase**; hosting free **GitHub Pages**.

## Setup (sirf ek baar, ~10 min)
1. https://console.firebase.google.com → **Add project** (Analytics band rakh sakte hain).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (Production mode, location `asia-south1`).
4. Firestore → **Rules** tab → `firestore.rules` file ka poora text paste karke **Publish**.
5. Project settings (⚙️) → **Your apps → `</>` Web** → app register → jo `firebaseConfig` mile use `firebase-config.js` mein paste karein.
6. GitHub par saari files upload karein (sab root mein, koi folder nahi).
7. GitHub repo → **Settings → Pages → Deploy from a branch → main / (root) → Save.** 1-2 min baad link: `https://USERNAME.github.io/REPO/`
8. Firebase → Authentication → **Settings → Authorized domains → Add domain** → `USERNAME.github.io`

## Login
Mobile number + 6 digit PIN. (Asli SMS OTP Firebase par paid plan maangta hai, isliye PIN use kiya hai.)

## Privacy
Phone number kisi ko nahi dikhta · offers/chat sirf group members/owner-requester padh sakte hain (firestore.rules) · block, report, leave group.
