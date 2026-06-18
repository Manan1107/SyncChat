// Password policy validation (simplified per request)
// Rules: 8-128 chars, at least 1 uppercase, 1 special character. Spaces allowed.

export function validatePasswordPolicy(password) {
  const result = { ok: true, errors: [] }
  if (typeof password !== 'string') {
    result.ok = false
    result.errors.push('Password must be a string')
    return result
  }
  const length = password.length
  if (length < 8 || length > 128) {
    result.ok = false
    result.errors.push('Password must be 8-128 characters long')
  }
  if (!/[A-Z]/.test(password)) {
    result.ok = false
    result.errors.push('Include at least one uppercase letter')
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    result.ok = false
    result.errors.push('Include at least one special character')
  }
  return result
}

export function passwordPolicyDescription() {
  return '8+ chars, at least one uppercase and one special character.'
}


