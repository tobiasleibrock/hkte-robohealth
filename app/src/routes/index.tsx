import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  ArrowRight,
  MapPin,
  Pill,
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export const Route = createFileRoute('/')({ component: LandingPage })

const days = ['Now', 'Today', 'Tomorrow', 'Fri']
const times = ['09', '12', '15', '18']
const routeStops = ['Building lobby', 'Elevator', '22/F hallway', 'Room 2206']
const medications = [
  {
    dose: '1x',
    name: 'Amlodipine 5mg',
    instruction: 'Morning after breakfast',
  },
  {
    dose: '2x',
    name: 'Paracetamol 500mg',
    instruction: 'Only if needed, max twice daily',
  },
  {
    dose: '1x',
    name: 'Vitamin D3',
    instruction: 'Evening with water',
  },
]

function LandingPage() {
  const [step, setStep] = useState<
    'order' | 'incoming' | 'locked' | 'outcome'
  >('order')
  const [day, setDay] = useState(days[0])
  const [time, setTime] = useState(times[1])

  return (
    <main
      className="flex h-dvh overflow-hidden justify-center bg-[#050505] px-5 pb-7 pt-6 text-white"
      aria-label="htke health robot booking"
    >
      <section className="flex h-[calc(100dvh-3.25rem)] w-full max-w-[430px] flex-col">
        {step === 'order' ? (
          <OrderScreen
            day={day}
            time={time}
            onDayChange={setDay}
            onTimeChange={setTime}
            onConfirm={() => setStep('incoming')}
          />
        ) : null}

        {step === 'incoming' ? (
          <IncomingScreen onArrived={() => setStep('locked')} />
        ) : null}

        {step === 'locked' ? (
          <RobotActiveScreen onContinue={() => setStep('outcome')} />
        ) : null}

        {step === 'outcome' ? (
          <OutcomeScreen onRestart={() => setStep('order')} />
        ) : null}
      </section>
    </main>
  )
}

function OrderScreen({
  day,
  time,
  onDayChange,
  onTimeChange,
  onConfirm,
}: {
  day: string
  time: string
  onDayChange: (value: string) => void
  onTimeChange: (value: string) => void
  onConfirm: () => void
}) {
  const isNow = day === 'Now'

  return (
    <Screen>
      <div className="flex min-h-0 flex-1 flex-col pb-3">
        <h1 className="m-0 pt-2 text-center text-2xl font-bold tracking-normal">
          Choose robot
        </h1>

        <div className="grid min-h-0 flex-1 place-items-center py-2">
          <img
            src="/robot.png"
            alt="Health robot"
            className="max-h-[27rem] w-full scale-110 object-contain"
          />
        </div>

        <div className="mb-4 grid gap-2 text-center">
          <h2 className="m-0 text-[1.9rem] font-bold leading-none tracking-normal">
            Health Robot
          </h2>
          <p className="mx-auto mb-0 mt-0 max-w-80 text-base leading-snug text-white/55">
            Comes to your apartment for basic checks.
          </p>
        </div>

        <PickerGroup label="Day">
          <ToggleGroup
            type="single"
            value={day}
            onValueChange={(value) => value && onDayChange(value)}
            className="grid w-full grid-cols-4 gap-2"
          >
            {days.map((option) => (
              <ToggleGroupItem
                key={option}
                value={option}
                className="h-12 rounded-2xl border border-white/15 bg-white/5 px-2 text-base font-semibold text-white/75 data-[state=on]:border-white data-[state=on]:bg-white data-[state=on]:text-[#050505]"
              >
                {option}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </PickerGroup>

        {!isNow ? (
          <PickerGroup label="Time">
            <ToggleGroup
              type="single"
              value={time}
              onValueChange={(value) => value && onTimeChange(value)}
              className="grid w-full grid-cols-4 gap-2"
            >
              {times.map((option) => (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  className="h-12 rounded-2xl border border-white/15 bg-white/5 px-2 text-base font-semibold text-white/75 data-[state=on]:border-white data-[state=on]:bg-white data-[state=on]:text-[#050505]"
                >
                  {option}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </PickerGroup>
        ) : null}
      </div>

      <BottomAction>
        <Button
          className="h-16 w-full rounded-2xl bg-white text-lg font-bold text-[#050505] hover:bg-white/90"
          onClick={onConfirm}
        >
          Schedule
          <ArrowRight />
        </Button>
      </BottomAction>
    </Screen>
  )
}

function IncomingScreen({ onArrived }: { onArrived: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(() => 90)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = String(secondsLeft % 60).padStart(2, '0')

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center pb-5">
        <div className="mb-14 text-center">
          <span className="mb-2 block text-2xl font-semibold text-white/55">
            Arrival in
          </span>
          <strong className="block text-[5.75rem] font-bold leading-none tracking-normal">
            {minutes}:{seconds}
          </strong>
        </div>

        <div
          className="mx-auto grid w-full max-w-72"
          aria-label="Mock robot route"
        >
          {routeStops.map((stop, index) => (
            <div
              className="relative grid min-h-16 grid-cols-[1.7rem_1fr] gap-4 text-xl font-semibold text-white/80"
              key={stop}
            >
              <span
                className={[
                  'z-10 mt-0.5 size-4 rounded-full border border-white/45 bg-[#050505]',
                  index < 3 ? 'bg-white' : '',
                ].join(' ')}
              />
              {index < routeStops.length - 1 ? (
                <span className="absolute bottom-0 left-[0.45rem] top-5 w-px bg-white/20" />
              ) : null}
              <span>{stop}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomAction>
        <Button
          className="h-16 w-full rounded-2xl bg-white text-lg font-bold text-[#050505] hover:bg-white/90"
          onClick={onArrived}
        >
          Robot arrived
          <ArrowRight />
        </Button>
      </BottomAction>
    </Screen>
  )
}

function RobotActiveScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-5 text-center">
        <img
          src="/robot.png"
          alt="Health robot"
          className="max-h-[27rem] w-full scale-110 object-contain"
        />
        <h1 className="m-0 text-[2.65rem] font-bold leading-none tracking-normal">
          Use the robot now
        </h1>
      </div>

      <BottomAction>
        <Button
          className="h-16 w-full rounded-2xl bg-white text-lg font-bold text-[#050505] hover:bg-white/90"
          onClick={onContinue}
        >
          Continue
          <ArrowRight />
        </Button>
      </BottomAction>
    </Screen>
  )
}

function OutcomeScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <Screen>
      <div className="flex-1 pb-5">
        <h1 className="mb-10 mt-10 text-[2.65rem] font-bold leading-none tracking-normal">
          Summary
        </h1>

        <div className="grid gap-5">
          <ResultRow icon={<Activity />} label="Heart" value="74 bpm" />
          <ResultRow icon={<MapPin />} label="Blood pressure" value="118 / 76" />
          <ResultRow icon={<Pill />} label="Medication" value="Refill pack" />
        </div>

        <div className="mt-8 grid gap-4 border-t border-white/10 pt-6">
          <div className="grid gap-1">
            <strong className="text-lg font-bold text-white">
              Order medication
            </strong>
            <span className="text-base font-semibold text-white/60">
              Nearby pharmacy delivery
            </span>
          </div>
          <div className="grid gap-3">
            {medications.map((medication) => (
              <div
                key={medication.name}
                className="grid grid-cols-[2.4rem_1fr] gap-3"
              >
                <span className="text-lg font-bold text-white">
                  {medication.dose}
                </span>
                <span className="grid gap-0.5">
                  <strong className="text-base font-bold text-white">
                    {medication.name}
                  </strong>
                  <span className="text-sm font-semibold text-white/55">
                    {medication.instruction}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomAction>
        <Button className="h-16 w-full rounded-2xl bg-white text-lg font-bold text-[#050505] hover:bg-white/90">
          Order now
          <ArrowRight />
        </Button>
        <Button
          variant="ghost"
          className="h-14 w-full rounded-2xl text-lg font-bold text-white hover:bg-white/10 hover:text-white"
          onClick={onRestart}
        >
          New visit
        </Button>
      </BottomAction>
    </Screen>
  )
}

function Screen({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>
}

function PickerGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <section className="mt-6 grid gap-3">
      <h2 className="m-0 text-base font-semibold text-white/60">{label}</h2>
      {children}
    </section>
  )
}

function BottomAction({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 pb-7 pt-4">{children}</div>
}

function ResultRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="grid grid-cols-[2.4rem_1fr_auto] items-center gap-3">
      <span className="grid size-10 place-items-center rounded-full border border-white/15">
        {icon}
      </span>
      <p className="m-0 text-base font-semibold text-white/60">{label}</p>
      <strong className="text-lg font-bold text-white">{value}</strong>
    </div>
  )
}
