import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { savePendingSignup, ensureProfile } from "@/lib/session";
import { fetchSuggestions, sendFriendRequest } from "@/lib/api";
import { UserAvatar } from "@/components/flowtext/UserAvatar";
import { cn } from "@/lib/utils";

const MIN_AGE = 13;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Step = 1 | 2 | 3 | 4 | 5 | "verify" | "friends";

function ageFrom(year: string, month: string, day: string) {
  if (!year || !month || !day) return null;
  const dob = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const before =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (before) age -= 1;
  return age;
}

function passwordStrength(value: string) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (score <= 2) return { label: "Weak", tone: "bg-clay", width: "33%" };
  if (score === 3) return { label: "Medium", tone: "bg-amber", width: "66%" };
  return { label: "Strong", tone: "bg-teal", width: "100%" };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const PHONE_RE = /^\+?[0-9][0-9\s\-()]{7,17}$/;

export function SignUpFlow({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "custom" | "">("");
  const [genderCustom, setGenderCustom] = useState("");
  const [method, setMethod] = useState<"mobile" | "email">("email");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const age = ageFrom(year, month, day);
  const strength = useMemo(() => passwordStrength(password), [password]);
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 105 }, (_, index) => String(current - index));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const contactValid =
    EMAIL_RE.test(email.trim()) && (method === "email" || PHONE_RE.test(phone.trim()));

  async function submit() {
    if (age === null || age < MIN_AGE) {
      toast.error(`You need to be at least ${MIN_AGE} to join FlowText.`);
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      const birthday = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      savePendingSignup({
        firstName: firstName.trim(),
        surname: surname.trim(),
        birthday,
        gender: gender || "unspecified",
        ...(gender === "custom" ? { genderCustom: genderCustom.trim() } : {}),
        ...(method === "mobile" && phone.trim() ? { phone: phone.trim() } : {}),
        email: email.trim(),
      });
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: `${firstName.trim()} ${surname.trim()}`.trim(),
            birthday,
            gender: gender === "custom" ? genderCustom.trim() : gender,
            phone: method === "mobile" ? phone.trim() : null,
          },
        },
      });
      if (error) throw error;
      if (data.session?.user) {
        await ensureProfile(data.session.user);
        setStep("friends");
        return;
      }
      setCooldown(30);
      setStep("verify");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't create your account.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "signup",
      });
      if (error) throw error;
      if (data.user) await ensureProfile(data.user);
      setStep("friends");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "That code didn't work. Try requesting a new one.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (error) throw error;
      toast.success("We sent a fresh code.");
      setCooldown(30);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send a new code.");
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = typeof step === "number" ? step : 5;

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => {
            if (typeof step === "number" && step > 1) setStep((step - 1) as Step);
            else if (step === "verify") setStep(5);
            else onCancel();
          }}
          className="rounded-full p-1.5 text-ink-soft ring-1 ring-ink/10 hover:bg-bone-soft"
        >
          ←
        </button>
        <h2 className="font-display text-lg font-semibold">
          {step === "verify"
            ? "Confirm your email"
            : step === "friends"
              ? "Find friends"
              : "Create a new account"}
        </h2>
      </div>

      {typeof step === "number" && (
        <div className="mt-4 flex gap-1.5" aria-hidden>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={cn("h-1 flex-1 rounded-full", n <= stepIndex ? "bg-clay" : "bg-ink/10")}
            />
          ))}
        </div>
      )}

      <div className="mt-5 space-y-4">
        {step === 1 && (
          <>
            <p className="text-sm text-ink-soft">What's your name?</p>
            <Input label="First name" value={firstName} onChange={setFirstName} autoFocus />
            <Input label="Surname" value={surname} onChange={setSurname} />
            <Next
              disabled={!firstName.trim() || !surname.trim()}
              onClick={() => setStep(2)}
              label="Next"
            />
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-ink-soft">
              What's your birthday? We use it to check your age.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Select label="Day" value={day} onChange={setDay}>
                {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
              <Select label="Month" value={month} onChange={setMonth}>
                {MONTHS.map((name, index) => (
                  <option key={name} value={String(index + 1)}>
                    {name}
                  </option>
                ))}
              </Select>
              <Select label="Year" value={year} onChange={setYear}>
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            {age !== null && age < MIN_AGE && (
              <p role="alert" className="text-xs font-semibold text-clay-deep">
                You need to be at least {MIN_AGE} years old to create a FlowText account.
              </p>
            )}
            <Next
              disabled={age === null || age < MIN_AGE}
              onClick={() => setStep(3)}
              label="Next"
            />
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-ink-soft">What's your gender?</p>
            <div className="space-y-2">
              {(["female", "male", "custom"] as const).map((option) => (
                <label
                  key={option}
                  className="flex cursor-pointer items-center justify-between rounded-xl bg-bone-soft px-3 py-2 text-sm ring-1 ring-ink/10"
                >
                  <span className="capitalize">{option}</span>
                  <input
                    type="radio"
                    name="gender"
                    checked={gender === option}
                    onChange={() => setGender(option)}
                    className="accent-teal"
                  />
                </label>
              ))}
            </div>
            {gender === "custom" && (
              <Input label="Specify" value={genderCustom} onChange={setGenderCustom} />
            )}
            <p className="text-xs text-ink-soft">
              You can change this later in settings, and your privacy settings control who can see
              it.
            </p>
            <Next
              disabled={!gender || (gender === "custom" && !genderCustom.trim())}
              onClick={() => setStep(4)}
              label="Next"
            />
          </>
        )}

        {step === 4 && (
          <>
            <div className="font-display flex gap-2">
              {(["mobile", "email"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMethod(option)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold",
                    method === option ? "bg-ink text-bone" : "text-ink-soft ring-1 ring-ink/10",
                  )}
                >
                  {option === "mobile" ? "Mobile number" : "Email address"}
                </button>
              ))}
            </div>
            {method === "mobile" && (
              <Input
                label="Mobile number"
                value={phone}
                onChange={setPhone}
                type="tel"
                placeholder="+27 82 000 0000"
              />
            )}
            <Input
              label="Email address"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="you@example.com"
            />
            {method === "mobile" && (
              <p className="text-xs text-ink-soft">
                We also need an email so we can send your confirmation code.
              </p>
            )}
            <Next disabled={!contactValid} onClick={() => setStep(5)} label="Next" />
          </>
        )}

        {step === 5 && (
          <>
            <p className="text-sm text-ink-soft">Create a password.</p>
            <label className="block">
              <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
                Password
              </span>
              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl bg-bone-soft px-3 py-2 pr-12 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-ink-soft"
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>
            <div>
              <div className="h-1 w-full rounded-full bg-ink/10">
                <div
                  className={cn("h-1 rounded-full transition-all", strength.tone)}
                  style={{ width: password ? strength.width : "0%" }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {password.length < 8
                  ? "Use at least 8 characters."
                  : `Strength: ${strength.label}`}
              </p>
            </div>
            <Next
              disabled={busy || password.length < 8}
              onClick={submit}
              label={busy ? "Creating…" : "Sign Up"}
            />
          </>
        )}

        {step === "verify" && (
          <>
            <p className="text-sm text-ink-soft">
              We sent a 6-digit code to {email}. It expires in 10 minutes.
            </p>
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              className="font-display w-full rounded-xl bg-bone-soft px-3 py-3 text-center text-2xl tracking-[0.4em] outline-none ring-1 ring-ink/10 focus:ring-teal/40"
              aria-label="6-digit code"
            />
            <Next
              disabled={busy || code.length !== 6}
              onClick={confirmCode}
              label={busy ? "Confirming…" : "Confirm"}
            />
            <button
              type="button"
              disabled={cooldown > 0 || busy}
              onClick={resend}
              className="w-full text-xs font-semibold text-teal disabled:text-ink-soft"
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
            <p className="text-xs text-ink-soft">
              You can also tap the confirmation link in that email.
            </p>
          </>
        )}

        {step === "friends" && <FindFriends onDone={() => navigate({ to: "/feed" })} />}
      </div>
    </div>
  );
}

function FindFriends({ onDone }: { onDone: () => void }) {
  const [people, setPeople] = useState<
    { id: string; display_name: string; avatar_url: string | null }[]
  >([]);
  const [added, setAdded] = useState<string[]>([]);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      setMe(data.user.id);
      try {
        const suggestions = await fetchSuggestions(data.user.id);
        if (active) setPeople(suggestions.slice(0, 6));
      } catch {
        /* suggestions are optional */
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <p className="text-sm text-ink-soft">
        People you might know. You can skip this and do it any time.
      </p>
      <ul className="mt-3 space-y-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex items-center gap-3 rounded-xl bg-bone-soft px-3 py-2 ring-1 ring-ink/5"
          >
            <UserAvatar name={person.display_name} url={person.avatar_url} size={36} />
            <span className="flex-1 truncate text-sm font-semibold">{person.display_name}</span>
            <button
              type="button"
              disabled={added.includes(person.id)}
              onClick={async () => {
                if (!me) return;
                await sendFriendRequest(me, person.id);
                setAdded((list) => [...list, person.id]);
              }}
              className="font-display rounded-full bg-clay px-3 py-1.5 text-xs font-semibold text-bone disabled:opacity-50"
            >
              {added.includes(person.id) ? "Requested" : "Add friend"}
            </button>
          </li>
        ))}
        {people.length === 0 && (
          <li className="text-sm text-ink-soft">No suggestions yet — your feed is ready.</li>
        )}
      </ul>
      <Next onClick={onDone} label="Go to my Feed" />
      <button
        type="button"
        onClick={onDone}
        className="mt-2 w-full text-xs font-semibold text-ink-soft"
      >
        Skip
      </button>
    </div>
  );
}

function Next({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-display mt-2 w-full rounded-full bg-clay px-4 py-2.5 text-sm font-semibold text-bone hover:bg-clay-deep disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl bg-bone-soft px-3 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-display text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl bg-bone-soft px-2 py-2 text-sm outline-none ring-1 ring-ink/10 focus:ring-teal/40"
      >
        <option value="">–</option>
        {children}
      </select>
    </label>
  );
}
