import type { AnyData } from "../../modules/utils/Types"

// Helper functions to extract specific error patterns
const extractFailedOpError = (message: string): string | null => {
  const match = message.match(/errorArgs=\[.*?,\s*"([^"]+)"\]/)
  return match?.[1] || null
}

const extractGasLimitError = (message: string): string | null => {
  const match = message.match(/code=([A-Z_]+),\s*version=/)
  return match?.[1] || null
}

const extractRevertError = (message: string): string | null => {
  const match = message.match(/"reason":"([^"]+)"/)
  return match?.[1] || null
}

const handleErrorsArray = (errors: AnyData[]): string => {
  // Handle array of error objects with msg and path properties
  if (typeof errors[0] === "object" && errors[0].msg) {
    return errors.map(({ msg, path }: AnyData) => `${path}: ${msg}`).join("\n")
  }

  const errorMessage = String(errors[0])
  const errorArgsMatch = errorMessage.match(/errorArgs=\[(.*?)"([^"]+)"\]/)
  return errorArgsMatch?.[2] || errorMessage
}

const cleanErrorMessage = (message: string): string => {
  return message
    .replace(/^(Error|Details|Message):\s*/i, "")
    .replace(/^error$/i, "")
    .trim()
}

export const parseErrorMessage = (error: unknown): string => {
  if (typeof error !== "object" || error === null) {
    const cleanedMessage = cleanErrorMessage(String(error))
    return (
      extractFailedOpError(cleanedMessage) ||
      extractGasLimitError(cleanedMessage) ||
      extractRevertError(cleanedMessage) ||
      cleanedMessage
    )
  }

  const errorObj = error as AnyData

  // Handle Across API error
  if (errorObj?.type === "AcrossApiError") {
    return errorObj?.type
  }

  // Handle Error instances
  if (error instanceof Error) {
    const message = String(error.message)

    // Try different error patterns
    const errorMessage =
      extractFailedOpError(message) ||
      extractGasLimitError(message) ||
      extractRevertError(message) ||
      message

    if (errorMessage !== message) {
      error.message = errorMessage // Update the original error message
    }
    return cleanErrorMessage(errorMessage)
  }

  // Handle object with errors array
  if (Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
    return cleanErrorMessage(handleErrorsArray(errorObj.errors))
  }

  // Handle object with message or statusText
  const message = String(errorObj.message || errorObj.statusText || error)
  const cleanedMessage = cleanErrorMessage(message)

  return (
    extractFailedOpError(cleanedMessage) ||
    extractGasLimitError(cleanedMessage) ||
    extractRevertError(cleanedMessage) ||
    cleanedMessage
  )
}
