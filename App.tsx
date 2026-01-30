/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import CameraScreen from './src/screens/CameraScreen';


function App() {

  return (
    <SafeAreaProvider>
      <CameraScreen />
    </SafeAreaProvider>
  );
}

export default App;
