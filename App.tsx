import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { Provider } from 'react-redux'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { store } from './src/store'
import AppNavigator from './src/navigation/AppNavigator'
import { useAppDispatch } from './src/store/hooks'
import { restoreSession } from './src/store/authSlice'

function Root() {
  const dispatch = useAppDispatch()
  useEffect(() => {
    dispatch(restoreSession())
  }, [dispatch])

  return (
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <Root />
      </Provider>
    </SafeAreaProvider>
  )
}

