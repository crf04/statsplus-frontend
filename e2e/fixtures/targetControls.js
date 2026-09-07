// Exercise the native slider through its public keyboard interaction.
export const setTargetThreshold = async (scope, percent) => {
  const slider = scope.getByRole('slider', { name: 'Qualifier 1 threshold percent' });
  await slider.press('Home');
  for (let value = 0; value < Number(percent); value += 1) await slider.press('ArrowRight');
};
