# Solusiku ID Card Dashboard
**IT Operations Control Center - ID Card Automation & GLPI Account Maker**

Solusiku ID Card Dashboard is a premium, web-based Progressive Web App (PWA) designed to automate employee ID card generation and streamline GLPI administrative onboarding workflows. Built for high-performance mobile and desktop environments, it offers state-of-the-art features including real-time AI background removal, advanced cropping, direct GLPI user account provisioning, and a fully-optimized mobile-native UX.

---

## 🌟 Premium Features

### 1. GLPI User Maker Engine
* **Automated Provisioning**: Direct API integrations to provision GLPI accounts from approved employee onboarding requests.
* **Technician-Specific Flow**: Accessible only to members with technician privileges.
* **Profile Completeness Assistant**: Real-time pop-up notifications containing custom guidelines reminding technicians to verify locations, groups, and profiles in GLPI before handing credentials to employees.
* **Polite Credentials Clipboard**: Copy Nama, Username, Password, and access links via clipboard for employees with a professional Indonesian instruction, excluding administrator-only remarks.

### 2. Native PWA Mobile Experience
* **Independent Scroll Container (ISC)**: Viewport-level scroll locking (`overflow: hidden` on root body) ensures top header bars and PWA bottom navigation tabs remain **100% physically locked in place** while only data cards scroll with native-smooth inertia.
* **Smart Horizontal Swipe Navigation**: Swipe left or right on the viewport to transition between bottom navigation menus with smart boundaries that ignore swipe-conflicts (e.g. crop sliders, modal dialogs).
* **Role-Based Navigation Filtering**: Swipe gesture routes dynamically self-adjust based on active visible navigation links corresponding to current user permissions.
* **Responsive Column-Stacking Cards**: Dynamic flex layouts stay side-by-side on wide screens but stack actions vertically within their column boundaries on mobile screenwidths to prevent layout horizontal leakage.

### 3. Smart Forms & Real-time Validation
* **Interactive Required Checks**: Dynamic fields validate in real-time. The "Create User" action button visually dims and prevents submission (`disabled`, `opacity: 0.5`, `cursor: not-allowed`) until all mandatory fields are fully satisfied.
* **Real-time Username Checking**: Instantly queries the GLPI server to check availability before submission is unlocked.

### 4. Header-Integrated FAB Refresh
* **Adaptive Positioning**: Floats gracefully at the top-right corner on desktops.
* **Native Header Integration**: Automatically repositions inside the Mobile Top Bar on narrow mobile screens, acting as a clean native-app toolbar action.

---

## 🛠️ Tech Stack

* **Core**: HTML5, Vanilla JavaScript (ES6+), CSS3 Variables & Flexbox
* **Build System**: Vite v6.x for high-performance HMR and optimized bundler pipelines
* **Image Processing**:
  * `@imgly/background-removal` (On-device WASM-powered AI background removal)
  * `cropperjs` (High-performance cropping tool)
  * `html-to-image` / `html2canvas` (Precise CSS/DOM image exports)
* **PWA & Serviceworkers**: `vite-plugin-pwa` with Workbox caching systems
* **Deployment**: Docker, Docker Compose, Apache HTTP Server

---

## 🚀 Getting Started

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   *Example `.env` content:*
   ```env
   VITE_N8N_WEBHOOK_URL=https://n8n.solusiku.id/webhook/idcard
   VITE_GLPI_API_URL=https://glpi.cb2.07.solusiku/apirest.php
   VITE_GLPI_APP_TOKEN=your_glpi_app_token
   VITE_GLPI_USER_TOKEN=your_glpi_bypass_user_token
   ```

3. **Launch Dev Server**
   ```bash
   npm run dev
   ```

---

## 🐳 Docker Deployment (Production)

The dashboard is optimized to run inside a high-security container served by Apache:

1. **Spin up using Docker Compose**
   ```bash
   docker-compose up -d --build
   ```

2. **Verify Access**
   Visit `http://<your-server-ip>:8080` to interact with your secure IT Ops control center.

---

## 📈 Optimization Best Practices
* **Independent Scroll Area**: All page components should be loaded directly inside `#page-container` within `#main-content`. Never declare body-level height overrides that break the `overflow: hidden` viewport lock.
* **Asset Optimization**: Images are lazily loaded on scrolling. Grid rendering is throttled using integrated client-side pagination to preserve memory in low-end PWA mobile browsers.
