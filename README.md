# Metasaver

Metasaver is a minimal and fast React Native application designed to work **without storing or collecting metadata**.
The main goal is to keep the application lightweight, privacy-focused, and easy to maintain.

## Why no metadata?
This project is intentionally designed to:
- Avoid storing or transmitting user metadata
- Not track user behavior, device info, or location
- Reduce complexity and improve performance
- Follow a privacy-first approach by default

Metadata is excluded **by design**, not by limitation.

## Features
- ✅ Lightweight and minimal architecture
- ✅ No metadata storage or tracking
- ✅ Clean and maintainable codebase
- ✅ Fast startup and low memory usage
- 🚫 No analytics or external tracking services (intentional)

## Technical Overview
- **Framework:** React Native (version: X)
- **State Management:** (Context / Zustand / Redux / None)
- **Storage:** (None / AsyncStorage / MMKV)
- **Architecture:** Feature-based / clean folder structure
- **Testing:** (Jest / none)

## Installation
```bash
git clone https://github.com/username/metasaver.git
cd metasaver
yarn install
yarn start
yarn android   # or yarn ios
