import React from 'react';
import { act, render } from '@testing-library/react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { openGatheringChat } from '@foyer/gatheringChat';

const Stack = createNativeStackNavigator();
const Blank = () => null;

const mount = () => {
  const ref = createNavigationContainerRef<any>();
  render(
    <NavigationContainer ref={ref}>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Blank} />
        <Stack.Screen name="GatheringDetail" component={Blank} />
        <Stack.Screen name="GatheringChat" component={Blank} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  return ref;
};

const names = (ref: ReturnType<typeof mount>) => ref.getRootState().routes.map((route) => route.name);

describe('gathering chat navigation (real stack)', () => {
  it('Gatherings row -> chat: Back lands on the gathering, then the Gatherings list', () => {
    const ref = mount();
    act(() => {
      openGatheringChat(ref as never, { activityId: 12, title: 'Game Night' });
    });
    expect(names(ref)).toEqual(['Tabs', 'GatheringDetail', 'GatheringChat']);
    act(() => ref.goBack());
    expect(names(ref)).toEqual(['Tabs', 'GatheringDetail']);
    expect(ref.getCurrentRoute()?.params).toEqual({ activityId: 12 });
  });

  it('gathering Chat pill -> chat: Back returns to the same gathering', () => {
    const ref = mount();
    act(() => ref.navigate('GatheringDetail', { activityId: 12 }));
    act(() => openGatheringChat(ref as never, { activityId: 12 }, { fromGathering: true }));
    expect(names(ref)).toEqual(['Tabs', 'GatheringDetail', 'GatheringChat']);
    act(() => ref.goBack());
    expect(ref.getCurrentRoute()?.name).toBe('GatheringDetail');
  });
});
