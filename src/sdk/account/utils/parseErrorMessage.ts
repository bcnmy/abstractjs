export const parseErrorMessage = (error: unknown): string => {
  let resultString = String(error)

  // Handle object-like errors with errors array or message field
  if (typeof error === "object" && error !== null) {
    if (error instanceof Error) {
      const message = String(error.message)

      // Check for FailedOp error pattern
      const failedOpMatch = message.match(/errorArgs=\[.*?,\s*"([^"]+)"\]/)
      if (failedOpMatch?.[1]) {
        error.message = failedOpMatch[1] // Update the original error message
        return failedOpMatch[1]
      }

      resultString = message
    }

    const errorObj = error as any
    // Check for errors array first
    if (Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
      const errorMessage = String(errorObj.errors[0])
      // Extract error message from errorArgs if present
      const errorArgsMatch = errorMessage.match(/errorArgs=\[(.*?)"([^"]+)"\]/)
      if (errorArgsMatch?.[2]) {
        return errorArgsMatch[2]
      }
      resultString = errorMessage
    }
    // Then check for message field
    else if (errorObj.message) {
      resultString = String(errorObj.message)
    }
    // Then check for statusText
    else if (errorObj.statusText) {
      resultString = String(errorObj.statusText)
    }
  }

  // Clean up common error prefixes and trim
  resultString = resultString
    .replace(/^(Error|Details|Message):\s*/i, "")
    .replace(/^error$/i, "")
    .trim()

  return resultString
}
