import { initialWorld, advanceWorld, facilities, boundaryState, distanceMetres } from './world'
it('conserves 300 unique virtual students and never exceeds a facility limit', () => {
  let world = initialWorld()
  for (let tick = 0; tick < 1000; tick++) {
    world = advanceWorld(world, tick)
    expect(new Set(world.map((p) => p.id)).size).toBe(300)
    for (let i = 0; i < facilities.length; i++)
      expect(world.filter((p) => p.place === i).length).toBeLessThanOrEqual(facilities[i]!.capacity)
  }
})
it('rejects imprecise GPS and uses an exit buffer', () => {
  expect(boundaryState(10, 5, 50)).toBe('inside')
  expect(boundaryState(10, 80, 50)).toBe('uncertain')
  expect(boundaryState(55, 5, 50)).toBe('uncertain')
  expect(boundaryState(90, 5, 50)).toBe('outside')
  expect(distanceMetres({ latitude: 30, longitude: 77 }, { latitude: 30, longitude: 77 })).toBe(0)
})
