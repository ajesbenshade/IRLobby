import type { ComponentType, PropsWithChildren } from 'react';
import {
  FlatList as NativeFlatList,
  Image as NativeImage,
  KeyboardAvoidingView as NativeKeyboardAvoidingView,
  RefreshControl as NativeRefreshControl,
  ScrollView as NativeScrollView,
  Text as NativeText,
  View as NativeView,
  type ImageProps,
  type KeyboardAvoidingViewProps,
  type RefreshControlProps,
  type ScrollViewProps,
  type TextProps,
  type ViewProps,
} from 'react-native';

export const View = NativeView as unknown as ComponentType<PropsWithChildren<ViewProps>>;
export const FlatList = NativeFlatList as unknown as ComponentType<any>;
export const Image = NativeImage as unknown as ComponentType<ImageProps>;
export const KeyboardAvoidingView = NativeKeyboardAvoidingView as unknown as ComponentType<PropsWithChildren<KeyboardAvoidingViewProps>>;
export const RefreshControl = NativeRefreshControl as unknown as ComponentType<RefreshControlProps>;
export const ScrollView = NativeScrollView as unknown as ComponentType<PropsWithChildren<ScrollViewProps>>;
export const Text = NativeText as unknown as ComponentType<PropsWithChildren<TextProps>>;
