# IRLobby Mobile App

Native iOS/Android app for IRLobby - Your Lobby for IRL Meetups

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g @expo/cli`
- For iOS: macOS with Xcode
- For Android: Android Studio

### Installation

1. **Install dependencies**
   ```bash
   cd IRLobbyMobile
   npm install
   ```

2. **Start the development server**
   ```bash
   npm start
   ```

3. **Run on device/emulator**
   - **iOS**: Press `i` in the terminal or scan QR code with Camera app on iOS
   - **Android**: Press `a` in the terminal or scan QR code with Expo Go app
   - **Web**: Press `w` in the terminal

## 📱 Features

- **Native Performance**: Built with React Native & Expo
- **Cross-Platform**: iOS and Android support
- **Real-time Chat**: WebSocket integration
- **Activity Discovery**: Find activities near you
- **User Authentication**: JWT-based auth
- **Offline Support**: AsyncStorage for local data

## 🏗️ Project Structure

```
IRLobbyMobile/
├── src/
│   ├── screens/          # App screens
│   │   ├── AuthScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── DiscoveryScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── context/          # React contexts
│   │   └── AuthContext.tsx
│   ├── services/         # API services
│   │   └── api.ts
│   ├── components/       # Reusable components
│   └── types/           # TypeScript types
├── App.tsx              # Main app component
└── app.json            # Expo configuration
```

## 🔧 Configuration

### API Configuration
Update the API base URL in `src/services/api.ts`:
```typescript
const API_BASE_URL = 'https://your-backend-url.onrender.com';
```

### Environment Variables
Create a `.env` file for environment-specific settings:
```env
API_BASE_URL=https://irlobby-backend.onrender.com
```

## 📦 Dependencies

### Core Dependencies
- **React Native**: Framework for native apps
- **Expo**: Development platform
- **React Navigation**: Navigation library
- **TanStack Query**: Data fetching and caching
- **AsyncStorage**: Local storage

### Development Dependencies
- **TypeScript**: Type safety
- **ESLint**: Code linting
- **Prettier**: Code formatting

## 🚀 Building for Production

### Build Commands
```bash
# Build for production
npm run build

# Build for specific platforms
npx expo build:ios
npx expo build:android
```

### App Store Deployment

#### iOS App Store
1. **Build the app**
   ```bash
   npx expo build:ios
   ```

2. **Download the build** from Expo dashboard

3. **Create Apple Developer Account** ($99/year)

4. **Upload to App Store Connect**
   - Create app record
   - Upload build
   - Add screenshots and descriptions
   - Submit for review

#### Google Play Store
1. **Build the app**
   ```bash
   npx expo build:android
   ```

2. **Download the build** from Expo dashboard

3. **Create Google Play Developer Account** ($25 one-time)

4. **Upload to Google Play Console**
   - Create app listing
   - Upload APK/AAB
   - Add store listing details
   - Publish to production

## 🔐 App Store Requirements

### iOS Requirements
- ✅ Unique App ID
- ✅ App Icons (various sizes)
- ✅ Screenshots (iPhone/iPad)
- ✅ Privacy Policy
- ✅ App Description
- ✅ Support URL
- ✅ Age Rating

### Android Requirements
- ✅ App Bundle/APK
- ✅ App Icons (various sizes)
- ✅ Screenshots (phone/tablet)
- ✅ Short/Long Description
- ✅ Privacy Policy
- ✅ Content Rating

## 🎨 Customization

### Theming
Update colors and styles in component StyleSheets:
```typescript
const styles = StyleSheet.create({
  primaryColor: '#007AFF',
  backgroundColor: '#f5f5f5',
  // ... other styles
});
```

### Icons and Assets
Add app icons to `assets/` directory and update `app.json`:
```json
{
  "icon": "./assets/icon.png",
  "splash": {
    "image": "./assets/splash.png"
  }
}
```

## 🐛 Troubleshooting

### Common Issues

**Metro bundler issues:**
```bash
npx expo start --clear
```

**iOS simulator issues:**
```bash
cd ios && pod install && cd ..
```

**Android emulator issues:**
```bash
npx expo start --android
```

## 📚 Resources

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policies](https://play.google.com/about/developer-content-policy/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on both iOS and Android
5. Submit a pull request

---

**IRLobby Mobile** - Bringing people together through native mobile experiences! 📱✨
