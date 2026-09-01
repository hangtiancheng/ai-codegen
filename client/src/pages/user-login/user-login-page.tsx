import { useForm } from "@tanstack/react-form";
import { type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import { useUserStore } from "@/shared/auth";
import { getZodFieldError } from "@/shared/lib";
import { useLogin } from "@/shared/query";
import { userLoginRequestSchema } from "@/shared/schemas";
import { AuthCard, Button, TextField } from "@/shared/ui";

const redirectTargetSchema = z
  .string()
  .startsWith("/")
  .refine((value) => !value.startsWith("//"), {
    message: "redirect must stay in the application",
  });

export function UserLoginPage(): ReactNode {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setUser = useUserStore((state) => state.setUser);
  const loginMutation = useLogin();
  const redirectTarget = readRedirectTarget(searchParams);

  const form = useForm({
    defaultValues: {
      userAccount: "",
      userPassword: "",
    },
    validators: {
      onSubmit: userLoginRequestSchema,
    },
    onSubmit: ({ value }) => {
      const request = userLoginRequestSchema.parse(value);
      loginMutation.mutate(request, {
        onSuccess: (user) => {
          setUser(user);
          toast.success("Login successful");
          navigate(redirectTarget, { replace: true });
        },
        onError: () => {
          toast.error("Login failed, please retry");
        },
      });
    },
  });

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-10">
      <AuthCard
        title="Swifty Codegen - Login"
        description="Create complete apps without writing code"
        footer={
          <span>
            Do not have an account?{" "}
            <Link
              to="/user/register"
              className="text-primary font-medium hover:underline"
            >
              Register
            </Link>
          </span>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field
            name="userAccount"
            validators={{ onBlur: userLoginRequestSchema.shape.userAccount }}
          >
            {(field) => (
              <TextField
                label="Account"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Enter account"
                autoComplete="username"
                errorMessage={getZodFieldError(
                  userLoginRequestSchema.shape.userAccount,
                  field.state.value,
                  field.state.meta.isTouched,
                )}
              />
            )}
          </form.Field>
          <form.Field
            name="userPassword"
            validators={{ onBlur: userLoginRequestSchema.shape.userPassword }}
          >
            {(field) => (
              <TextField
                label="Password"
                name={field.name}
                type="password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                errorMessage={getZodFieldError(
                  userLoginRequestSchema.shape.userPassword,
                  field.state.value,
                  field.state.meta.isTouched,
                )}
              />
            )}
          </form.Field>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                className="mt-1 w-full"
                disabled={!canSubmit || loginMutation.isPending}
                isLoading={isSubmitting || loginMutation.isPending}
              >
                Login
              </Button>
            )}
          </form.Subscribe>
        </form>
      </AuthCard>
    </div>
  );
}

function readRedirectTarget(searchParams: URLSearchParams): string {
  const redirect = searchParams.get("redirect");
  if (redirect === null) {
    return "/";
  }
  try {
    return redirectTargetSchema.parse(redirect);
  } catch {
    return "/";
  }
}
