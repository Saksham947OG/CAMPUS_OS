import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { RoutePlaceholderPage } from '@/features/placeholders/route-placeholder-page'
import { NotFoundPage } from './pages/not-found-page'
import { RootErrorPage, RouteErrorPage } from './pages/route-error-page'
import { routes, type RouteDef } from './routes'
import { AppShell } from './shell/app-shell'

// Route-level code splitting keeps the first load small; each feature loads when first visited.
const CalendarPage = lazy(() =>
  import('@/features/calendar/calendar-page').then((m) => ({ default: m.CalendarPage })),
)
const HomePage = lazy(() =>
  import('@/features/home/home-page').then((m) => ({ default: m.HomePage })),
)
const NotificationsPage = lazy(() =>
  import('@/features/notifications/notifications-page').then((m) => ({
    default: m.NotificationsPage,
  })),
)
const ChillSpotPage = lazy(() =>
  import('@/features/chill/chill-page').then((m) => ({ default: m.ChillSpotPage })),
)
const ChillOrderPage = lazy(() =>
  import('@/features/chill/order-page').then((m) => ({ default: m.ChillOrderPage })),
)
const ServicesHubPage = lazy(() =>
  import('@/features/services/services-hub-page').then((m) => ({ default: m.ServicesHubPage })),
)
const LaundryHubPage = lazy(() =>
  import('@/features/essentials/laundry-pages').then((m) => ({ default: m.LaundryHubPage })),
)
const SsLaundryPage = lazy(() =>
  import('@/features/essentials/laundry-pages').then((m) => ({ default: m.SsLaundryPage })),
)
const LoadDetailPage = lazy(() =>
  import('@/features/essentials/laundry-pages').then((m) => ({ default: m.LoadDetailPage })),
)
const MachinesPage = lazy(() =>
  import('@/features/essentials/machines-page').then((m) => ({ default: m.MachinesPage })),
)
const MessPage = lazy(() =>
  import('@/features/essentials/mess-pages').then((m) => ({ default: m.MessPage })),
)
const MessFeesPage = lazy(() =>
  import('@/features/essentials/mess-pages').then((m) => ({ default: m.MessFeesPage })),
)
const ParcelsPage = lazy(() =>
  import('@/features/essentials/parcel-pages').then((m) => ({ default: m.ParcelsPage })),
)
const ParcelDetailPage = lazy(() =>
  import('@/features/essentials/parcel-pages').then((m) => ({ default: m.ParcelDetailPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/settings-page').then((m) => ({ default: m.SettingsPage })),
)

function Loading({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<output className="block text-ink-muted">Loading…</output>}>
      {children}
    </Suspense>
  )
}

const BookingsHubPage = lazy(() =>
  import('@/features/sports/bookings-pages').then((m) => ({ default: m.BookingsHubPage })),
)
const BadmintonPage = lazy(() =>
  import('@/features/sports/bookings-pages').then((m) => ({ default: m.BadmintonPage })),
)
const OtherSportsPage = lazy(() =>
  import('@/features/sports/bookings-pages').then((m) => ({ default: m.OtherSportsPage })),
)
const ResourcePage = lazy(() =>
  import('@/features/sports/bookings-pages').then((m) => ({ default: m.ResourcePage })),
)
const GymPage = lazy(() =>
  import('@/features/sports/gym-page').then((m) => ({ default: m.GymPage })),
)
const MyBookingsPage = lazy(() =>
  import('@/features/sports/my-pages').then((m) => ({ default: m.MyBookingsPage })),
)
const BookingDetailPage = lazy(() =>
  import('@/features/sports/my-pages').then((m) => ({ default: m.BookingDetailPage })),
)
const WaitlistPage = lazy(() =>
  import('@/features/sports/my-pages').then((m) => ({ default: m.WaitlistPage })),
)

const LibraryPage = lazy(() =>
  import('@/features/sports/spaces-pages').then((m) => ({ default: m.LibraryPage })),
)
const LibraryBooksPage = lazy(() =>
  import('@/features/sports/spaces-pages').then((m) => ({ default: m.LibraryBooksPage })),
)
const LibraryLoansPage = lazy(() =>
  import('@/features/sports/spaces-pages').then((m) => ({ default: m.LibraryLoansPage })),
)
const MusicRoomPage = lazy(() =>
  import('@/features/sports/spaces-pages').then((m) => ({ default: m.MusicRoomPage })),
)
const ChillZonePage = lazy(() =>
  import('@/features/sports/spaces-pages').then((m) => ({ default: m.ChillZonePage })),
)

const AdminHubPage = lazy(() =>
  import('@/features/administration/admin-pages').then((m) => ({ default: m.AdminHubPage })),
)
const MyRequestsPage = lazy(() =>
  import('@/features/administration/admin-pages').then((m) => ({ default: m.MyRequestsPage })),
)
const RequestLinkPage = lazy(() =>
  import('@/features/administration/admin-pages').then((m) => ({ default: m.RequestLinkPage })),
)
const LeavePage = lazy(() =>
  import('@/features/administration/leave-pages').then((m) => ({ default: m.LeavePage })),
)
const LeaveNewPage = lazy(() =>
  import('@/features/administration/leave-pages').then((m) => ({ default: m.LeaveNewPage })),
)
const LeaveDetailPage = lazy(() =>
  import('@/features/administration/leave-pages').then((m) => ({ default: m.LeaveDetailPage })),
)
const ComplaintsPage = lazy(() =>
  import('@/features/administration/ticket-pages').then((m) => ({ default: m.ComplaintsPage })),
)
const ComplaintNewPage = lazy(() =>
  import('@/features/administration/ticket-pages').then((m) => ({ default: m.ComplaintNewPage })),
)
const TeachingAidsPage = lazy(() =>
  import('@/features/administration/ticket-pages').then((m) => ({ default: m.TeachingAidsPage })),
)
const TeachingAidNewPage = lazy(() =>
  import('@/features/administration/ticket-pages').then((m) => ({ default: m.TeachingAidNewPage })),
)
const TicketDetailPage = lazy(() =>
  import('@/features/administration/ticket-pages').then((m) => ({ default: m.TicketDetailPage })),
)

const NotificationPrefsPage = lazy(() =>
  import('@/features/shared/notification-prefs-page').then((m) => ({
    default: m.NotificationPrefsPage,
  })),
)
const ExamsPage = lazy(() =>
  import('@/features/shared/exam-pages').then((m) => ({ default: m.ExamsPage })),
)
const ExamDetailPage = lazy(() =>
  import('@/features/shared/exam-pages').then((m) => ({ default: m.ExamDetailPage })),
)
const BestTimePage = lazy(() =>
  import('@/features/shared/best-time-page').then((m) => ({ default: m.BestTimePage })),
)
const TimeTaxPage = lazy(() =>
  import('@/features/shared/time-tax-pages').then((m) => ({ default: m.TimeTaxPage })),
)
const TimeTaxScenariosPage = lazy(() =>
  import('@/features/shared/time-tax-pages').then((m) => ({ default: m.TimeTaxScenariosPage })),
)
const TimeTaxObservationsPage = lazy(() =>
  import('@/features/shared/time-tax-pages').then((m) => ({ default: m.TimeTaxObservationsPage })),
)

const AcademicsHubPage = lazy(() =>
  import('@/features/academics/course-pages').then((m) => ({ default: m.AcademicsHubPage })),
)
const CoursesPage = lazy(() =>
  import('@/features/academics/course-pages').then((m) => ({ default: m.CoursesPage })),
)
const CoursePage = lazy(() =>
  import('@/features/academics/course-pages').then((m) => ({ default: m.CoursePage })),
)
const FacultyDirectoryPage = lazy(() =>
  import('@/features/academics/meeting-pages').then((m) => ({ default: m.FacultyDirectoryPage })),
)
const FacultyProfilePage = lazy(() =>
  import('@/features/academics/meeting-pages').then((m) => ({ default: m.FacultyProfilePage })),
)
const FacultyMeetingsPage = lazy(() =>
  import('@/features/academics/meeting-pages').then((m) => ({ default: m.FacultyMeetingsPage })),
)
const FacultyNewPage = lazy(() =>
  import('@/features/academics/meeting-pages').then((m) => ({ default: m.FacultyNewPage })),
)
const OfficePage = lazy(() =>
  import('@/features/academics/meeting-pages').then((m) => ({ default: m.OfficePage })),
)
const OfficeMeetingsPage = lazy(() =>
  import('@/features/academics/meeting-pages').then((m) => ({ default: m.OfficeMeetingsPage })),
)
const OfficeNewPage = lazy(() =>
  import('@/features/academics/meeting-pages').then((m) => ({ default: m.OfficeNewPage })),
)
const MeetingDetailPage = lazy(() =>
  import('@/features/academics/meeting-pages').then((m) => ({ default: m.MeetingDetailPage })),
)
const MentorshipPage = lazy(() =>
  import('@/features/academics/mentorship-pages').then((m) => ({ default: m.MentorshipPage })),
)
const GroupPage = lazy(() =>
  import('@/features/academics/mentorship-pages').then((m) => ({ default: m.GroupPage })),
)

const academicsPages: Record<string, () => ReactNode> = {
  academics: () => <AcademicsHubPage />,
  'academics-courses': () => <CoursesPage />,
  'academics-course': () => <CoursePage />,
  'academics-course-tab': () => <CoursePage />,
  'academics-faculty': () => <FacultyDirectoryPage />,
  'academics-faculty-meetings': () => <FacultyMeetingsPage />,
  'academics-faculty-new': () => <FacultyNewPage />,
  'academics-faculty-profile': () => <FacultyProfilePage />,
  'academics-mentorship': () => <MentorshipPage />,
  'academics-group': () => <GroupPage />,
  'academics-office': () => <OfficePage />,
  'academics-office-meetings': () => <OfficeMeetingsPage />,
  'academics-office-new': () => <OfficeNewPage />,
  'academics-meeting': () => <MeetingDetailPage />,
}

const lz = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, k: K) =>
  lazy(() => load().then((m) => ({ default: m[k] })))
const CommunityHubPage = lz(
  () => import('@/features/community/community-pages'),
  'CommunityHubPage',
)
const LostFoundPage = lz(() => import('@/features/community/lostfound-pages'), 'LostFoundPage')
const ReportNewPage = lz(() => import('@/features/community/lostfound-pages'), 'ReportNewPage')
const ReportDetailPage = lz(
  () => import('@/features/community/lostfound-pages'),
  'ReportDetailPage',
)
const ClaimPage = lz(() => import('@/features/community/lostfound-pages'), 'ClaimPage')
const ClubsPage = lz(() => import('@/features/community/club-pages'), 'ClubsPage')
const ClubPage = lz(() => import('@/features/community/club-pages'), 'ClubPage')
const ClubRequestsPage = lz(() => import('@/features/community/club-pages'), 'ClubRequestsPage')
const SportsPage = lz(() => import('@/features/community/sports-pages'), 'SportsPage')
const TeamPage = lz(() => import('@/features/community/sports-pages'), 'TeamPage')
const FixturePage = lz(() => import('@/features/community/sports-pages'), 'FixturePage')
const ParticipationPage = lz(() => import('@/features/community/sports-pages'), 'ParticipationPage')

const communityPages: Record<string, () => ReactNode> = {
  community: () => <CommunityHubPage />,
  'community-lost-found': () => <LostFoundPage />,
  'community-lost-found-new': () => <ReportNewPage />,
  'community-report': () => <ReportDetailPage />,
  'community-claim': () => <ClaimPage />,
  'community-clubs': () => <ClubsPage />,
  'community-club': () => <ClubPage />,
  'community-club-requests': () => <ClubRequestsPage />,
  'community-sports': () => <SportsPage />,
  'community-team': () => <TeamPage />,
  'community-fixture': () => <FixturePage />,
  'community-participation': () => <ParticipationPage />,
}

const ClassroomsPage = lazy(() =>
  import('@/features/classrooms/classroom-pages').then((m) => ({ default: m.ClassroomsPage })),
)
const ClassroomBookingPage = lazy(() =>
  import('@/features/classrooms/classroom-pages').then((m) => ({
    default: m.ClassroomBookingPage,
  })),
)

const MailPage = lazy(() =>
  import('@/features/mail/mail-pages').then((m) => ({ default: m.MailPage })),
)
const MailDetailPage = lazy(() =>
  import('@/features/mail/mail-pages').then((m) => ({ default: m.MailDetailPage })),
)

const FindATimePage = lazy(() =>
  import('@/features/meetings/find-a-time-page').then((m) => ({ default: m.FindATimePage })),
)
const MeetingPage = lazy(() =>
  import('@/features/meetings/meeting-pages').then((m) => ({ default: m.MeetingPage })),
)
const PollsPage = lazy(() =>
  import('@/features/meetings/meeting-pages').then((m) => ({ default: m.PollsPage })),
)
const PollPage = lazy(() =>
  import('@/features/meetings/meeting-pages').then((m) => ({ default: m.PollPage })),
)

const GradesPage = lazy(() =>
  import('@/features/academics/grades-pages').then((m) => ({ default: m.GradesPage })),
)
const AttendancePage = lazy(() =>
  import('@/features/academics/grades-pages').then((m) => ({ default: m.AttendancePage })),
)

const ReportPage = lazy(() =>
  import('@/features/help/report-page').then((m) => ({ default: m.ReportPage })),
)

const sharedPages: Record<string, () => ReactNode> = {
  'notification-prefs': () => <NotificationPrefsPage />,
  mail: () => <MailPage />,
  'help-report': () => <ReportPage />,
  'academics-grades': () => <GradesPage />,
  'academics-attendance': () => <AttendancePage />,
  'calendar-find-a-time': () => <FindATimePage />,
  'calendar-meeting': () => <MeetingPage />,
  'calendar-polls': () => <PollsPage />,
  'calendar-poll': () => <PollPage />,
  'mail-detail': () => <MailDetailPage />,
  'academics-exams': () => <ExamsPage />,
  'academics-exam-detail': () => <ExamDetailPage />,
  'best-time': () => <BestTimePage />,
  'time-tax': () => <TimeTaxPage />,
  'time-tax-scenarios': () => <TimeTaxScenariosPage />,
  'time-tax-observations': () => <TimeTaxObservationsPage />,
}

const adminPages: Record<string, () => ReactNode> = {
  administration: () => <AdminHubPage />,
  'administration-leave': () => <LeavePage />,
  'administration-leave-new': () => <LeaveNewPage />,
  'administration-leave-detail': () => <LeaveDetailPage />,
  'administration-complaints': () => <ComplaintsPage />,
  'administration-complaints-new': () => <ComplaintNewPage />,
  'administration-complaint-detail': () => <TicketDetailPage />,
  'administration-teaching': () => <TeachingAidsPage />,
  'administration-teaching-new': () => <TeachingAidNewPage />,
  'administration-teaching-detail': () => <TicketDetailPage />,
  'administration-requests': () => <MyRequestsPage />,
  'administration-request-link': () => <RequestLinkPage />,
}

const essentialsPages: Record<string, () => ReactNode> = {
  'bookings-library': () => <LibraryPage />,
  'bookings-library-space': () => <ResourcePage />,
  'bookings-library-books': () => <LibraryBooksPage />,
  'bookings-library-loans': () => <LibraryLoansPage />,
  'bookings-music': () => <MusicRoomPage />,
  'bookings-chill': () => <ChillZonePage />,
  bookings: () => <BookingsHubPage />,
  'bookings-classrooms': () => <ClassroomsPage />,
  'bookings-classroom-booking': () => <ClassroomBookingPage />,
  'bookings-gym': () => <GymPage />,
  'bookings-badminton': () => <BadmintonPage />,
  'bookings-sports': () => <OtherSportsPage />,
  'bookings-resource': () => <ResourcePage />,
  'bookings-my': () => <MyBookingsPage />,
  'bookings-my-detail': () => <BookingDetailPage />,
  'bookings-waitlist': () => <WaitlistPage />,
  laundry: () => <LaundryHubPage />,
  'laundry-ss': () => <SsLaundryPage />,
  'laundry-load': () => <LoadDetailPage />,
  'laundry-machines': () => <MachinesPage />,
  mess: () => <MessPage />,
  'mess-fees': () => <MessFeesPage />,
  parcels: () => <ParcelsPage />,
  'parcel-detail': () => <ParcelDetailPage />,
}

function elementFor(route: RouteDef) {
  const essentials =
    essentialsPages[route.id] ??
    adminPages[route.id] ??
    sharedPages[route.id] ??
    academicsPages[route.id] ??
    communityPages[route.id]
  if (essentials) return <Loading>{essentials()}</Loading>
  if (route.id === 'chill-spot')
    return (
      <Loading>
        <ChillSpotPage />
      </Loading>
    )
  if (route.id === 'chill-order')
    return (
      <Loading>
        <ChillOrderPage />
      </Loading>
    )
  if (route.id === 'services')
    return (
      <Loading>
        <ServicesHubPage />
      </Loading>
    )
  if (route.id === 'settings')
    return (
      <Loading>
        <SettingsPage />
      </Loading>
    )
  if (route.id === 'calendar')
    return (
      <Loading>
        <CalendarPage />
      </Loading>
    )
  if (route.id === 'home')
    return (
      <Loading>
        <HomePage />
      </Loading>
    )
  if (route.id === 'notifications')
    return (
      <Loading>
        <NotificationsPage />
      </Loading>
    )
  return <RoutePlaceholderPage route={route} />
}

/**
 * Every registry entry becomes a route. When a feature goes live in a later phase, only its
 * element here and its status in routes.ts change.
 */
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    ErrorBoundary: RootErrorPage,
    children: [
      {
        // Pathless boundary so a page error keeps the shell (and navigation) on screen.
        ErrorBoundary: RouteErrorPage,
        children: [
          ...routes.map<RouteObject>((route) =>
            route.path === '/'
              ? { index: true, element: elementFor(route) }
              : { path: route.path.slice(1), element: elementFor(route) },
          ),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(appRoutes)
