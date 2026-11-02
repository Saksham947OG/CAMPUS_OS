import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeServices, renderApp } from '@/test/render-app'
it('requires explicit opt-in, two accurate fixes and clears tracking on checkout', async () => {
  let success: PositionCallback = () => {}
  const watchPosition = vi.fn((callback: PositionCallback) => {
      success = callback
      return 7
    }),
    clearWatch = vi.fn()
  const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition, clearWatch },
  })
  try {
    const user = userEvent.setup()
    renderApp('/', { services: makeServices({ sourceData: true }).services })
    await screen.findByRole('heading', { level: 1, name: /Ananya/ })
    expect(watchPosition).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Show all places' }))
    await user.click(screen.getByRole('button', { name: 'Real check-in setup' }))
    await user.type(screen.getByLabelText('Latitude'), '30')
    await user.type(screen.getByLabelText('Longitude'), '77')
    await user.click(screen.getByRole('button', { name: 'Enable location check-in' }))
    expect(watchPosition).toHaveBeenCalledOnce()
    const fix = { coords: { latitude: 30, longitude: 77, accuracy: 5 } } as GeolocationPosition
    act(() => success(fix))
    expect(screen.queryByText(/Two accurate fixes confirm you are inside/)).not.toBeInTheDocument()
    act(() => success(fix))
    expect(screen.getByText(/Two accurate fixes confirm you are inside/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop and check out' }))
    expect(clearWatch).toHaveBeenCalledWith(7)
  } finally {
    if (original) Object.defineProperty(navigator, 'geolocation', original)
    else Reflect.deleteProperty(navigator, 'geolocation')
  }
})
