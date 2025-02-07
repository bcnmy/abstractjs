import type { AnyData } from "../../modules/utils/Types"

// Helper functions to extract specific error patterns
const extractFailedOpError = (message: string): string | null => {
  // First try to match AA23 revert message pattern
  const aa23Match = message.match(
    /errorArgs=\[.*?,\s*"(AA23[^"]+)",\s*"(0x[^"]+)"\]/
  )
  if (aa23Match) {
    // If it's an AA23 error, return the decoded message
    try {
      // Extract the hex data starting after the first 32 bytes (position of string)
      const hexData = aa23Match[2].slice(130)
      // Convert hex to ASCII, removing null bytes, control characters, and padding
      const decoded = Buffer.from(hexData.replace(/00+$/, ""), "hex")
        .toString()
        // biome-ignore lint/suspicious/noControlCharactersInRegex: <explanation>
        .replace(/[\u0000-\u001F]/g, "") // Remove all control characters
      return decoded
    } catch {
      return aa23Match[1] // Fallback to AA23 message if decoding fails
    }
  }

  // Original pattern for other error types
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
  // Try to extract error using the same patterns as the main function
  return (
    extractFailedOpError(errorMessage) ||
    extractGasLimitError(errorMessage) ||
    extractRevertError(errorMessage) ||
    errorMessage
  )
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
    return [errorObj?.type, errorObj?.message].join(": ")
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
