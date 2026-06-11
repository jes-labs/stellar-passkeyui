import { PasskeyFlow, type PasskeyFlowLabels, type PasskeyFlowProps } from './PasskeyFlow'

// Thin presets over PasskeyFlow with sensible default copy for the three flows.
// Each still accepts label overrides, so the wording stays in the consumer's
// hands.
type PresetProps<Result> = PasskeyFlowProps<Result>

function withDefaultLabels<Result>(props: PresetProps<Result>, defaults: PasskeyFlowLabels) {
  return { ...props, labels: { ...defaults, ...props.labels } }
}

export function CreatePasskey<Result>(props: PresetProps<Result>) {
  return (
    <PasskeyFlow
      {...withDefaultLabels(props, {
        action: 'Create passkey',
        prompting: 'Follow your device’s prompt to create a passkey…',
        success: 'Passkey created.',
      })}
    />
  )
}

export function SignTransaction<Result>(props: PresetProps<Result>) {
  return (
    <PasskeyFlow
      {...withDefaultLabels(props, {
        action: 'Sign',
        prompting: 'Confirm with your passkey…',
        success: 'Signed.',
      })}
    />
  )
}

export function Recover<Result>(props: PresetProps<Result>) {
  return (
    <PasskeyFlow
      {...withDefaultLabels(props, {
        action: 'Add this device',
        prompting: 'Follow the prompt to add this device…',
        success: 'Device added.',
      })}
    />
  )
}
