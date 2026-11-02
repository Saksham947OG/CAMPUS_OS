import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createServices } from '@/app/services'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { createMemoryStorage } from '@/test/memory-storage'
import { fixedClock } from '@/lib/time'
import { renderApp } from '@/test/render-app'

const sourceServices = () =>
  createServices({
    sourceData: true,
    storage: createStorageAdapter({ backend: createMemoryStorage().storage }),
    clock: fixedClock('2026-11-03T04:30:00Z'),
  })
it('renders the source-backed dashboard and switches all three personalized views', async () => {
  const user = userEvent.setup()
  renderApp('/', { services: sourceServices() })
  expect(
    await screen.findByRole('heading', { level: 1, name: /Ananya Sharma/ }),
  ).toBeInTheDocument()
  expect(await screen.findByText(/53–69 min/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Persona:/ }))
  await user.click(screen.getByRole('menuitemradio', { name: /Abeer Sethi/ }))
  expect(await screen.findByRole('heading', { level: 1, name: /Abeer Sethi/ })).toBeInTheDocument()
  expect(screen.queryByText('Check quiz venue and syllabus')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /^Persona:/ }))
  await user.click(screen.getByRole('menuitemradio', { name: /Myra Kapoor/ }))
  expect(await screen.findByRole('heading', { level: 1, name: /Myra Kapoor/ })).toBeInTheDocument()
  expect(await screen.findByText('Assign club event owners')).toBeInTheDocument()
})
it('checks every service source and saves a timed observation that survives another repository read', async () => {
  const user = userEvent.setup(),
    services = sourceServices()
  renderApp('/time-tax', { services })
  expect(await screen.findByRole('heading', { level: 1, name: 'Time Tax' })).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByText(/11\/11 app data sources checked/)).toBeInTheDocument(),
  )
  await user.click(screen.getByText(/Record a timed observation/))
  await user.selectOptions(screen.getByLabelText('Process'), 'lunch')
  await user.type(screen.getByLabelText('Minutes actually waiting'), '12')
  await user.type(screen.getByLabelText('How was this timed?'), 'Stopwatch at lunch counter')
  await user.click(screen.getByRole('button', { name: 'Save observation' }))
  expect(await screen.findByText('Observation saved.')).toBeInTheDocument()
  expect(services.observations.load('demo-student-a')[0]).toMatchObject({
    processId: 'lunch',
    minutes: 12,
  })
  expect(services.observations.load('demo-student-b')).toEqual([])
  expect(screen.getByText(/12.0 min \(n=1\)/)).toBeInTheDocument()
})
it('searches all source documents and exposes data gaps without publishing private roster rows', async () => {
  const user = userEvent.setup()
  renderApp('/sources', { services: sourceServices() })
  expect(
    await screen.findByRole('heading', { name: 'Source register · all 28 files' }),
  ).toBeInTheDocument()
  await user.type(screen.getByLabelText('Search source files and extracted text'), 'ID CARDS')
  const source = screen.getByRole('heading', { name: 'ID CARDS BMS - 2.pdf' }).closest('li')!
  expect(within(source).getByText('Protected access needed')).toBeInTheDocument()
  expect(screen.queryByText('BMS25113')).not.toBeInTheDocument()
})
