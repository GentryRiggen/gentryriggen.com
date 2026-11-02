import { secondFactor, startTotp } from "@/lib/jim/auth";
import { jimTestHook, type JimTestTwoStep } from "@/lib/jim/testHooks";

/** What Sign-in & security needs from Jim's sign-in. */
export interface TwoStep {
  secondFactor: typeof secondFactor;
  startTotp: typeof startTotp;
}

function codeError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

/** The e2e stand-in: no Firebase, the values the test chose. */
function standIn(config: JimTestTwoStep): TwoStep {
  let enrolled = config.enrolled;
  return {
    secondFactor: async () => ({ enrolled, thisSession: enrolled }),
    startTotp: async (password) => {
      if (password !== config.password) throw codeError("auth/wrong-password");
      return {
        secret: config.secret,
        url: `otpauth://totp/Jim:owner%40example.com?secret=${config.secret}&issuer=Jim`,
        finish: async (code) => {
          if (code !== config.code) {
            throw codeError("auth/invalid-verification-code");
          }
          enrolled = true;
        },
      };
    },
  };
}

/**
 * Jim's sign-in for the security sheet, or the e2e stand-in. The build flags
 * are written out in full so the shipped build drops the stand-in.
 */
export function jimTwoStep(): TwoStep {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_E2E === "1"
  ) {
    const hook = jimTestHook();
    if (hook?.signedIn === true && hook.twoStep) return standIn(hook.twoStep);
  }
  return { secondFactor, startTotp };
}
