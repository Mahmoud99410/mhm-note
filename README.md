# MHM NOTE

Encrypted notes & passwords app — Android (APK) and Windows (EXE).

- Web UI (React + Vite), Android via Capacitor, Windows via Electron
- AES-256-GCM encryption, master key from Argon2id; recovery key
- Every push to `main` builds the APK and EXE in GitHub Actions and publishes them under **Releases**
