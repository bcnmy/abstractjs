export const parseErrorMessage = (error: unknown): string => {
  let resultString = String(error)

  if (error instanceof Error) {
    const message = error.message

    // Check for FailedOp error pattern
    const failedOpMatch = message.match(/errorArgs=\[.*?,\s*"([^"]+)"\]/)
    if (failedOpMatch?.[1]) {
      error.message = failedOpMatch[1] // Update the original error message
      return failedOpMatch[1]
    }

    resultString = message
  }

  resultString = resultString
    .replace(/^(Error|Details|Message):\s*/i, "")
    .replace(/^error$/i, "")
    .trim()

  return resultString
}
