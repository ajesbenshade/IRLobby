import type { ComponentProps, ComponentType } from 'react';
import type { TextInputProps as NativeTextInputProps } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';

type CompatTextInputProps = ComponentProps<typeof PaperTextInput> &
  Pick<
    NativeTextInputProps,
    'autoCapitalize' | 'autoComplete' | 'autoCorrect' | 'keyboardType' | 'secureTextEntry'
  >;

export const TextInput = PaperTextInput as unknown as ComponentType<CompatTextInputProps>;
