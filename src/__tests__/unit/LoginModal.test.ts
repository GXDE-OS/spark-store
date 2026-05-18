import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import LoginModal from "@/components/LoginModal.vue";

describe("LoginModal", () => {
  it("emits login credentials and register request", async () => {
    const rendered = render(LoginModal, {
      props: { show: true, loading: false, error: "" },
    });

    await fireEvent.update(screen.getByLabelText("论坛账号"), "  momen  ");
    await fireEvent.update(screen.getByLabelText("论坛密码"), "  secret  ");
    await fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await fireEvent.click(screen.getByRole("button", { name: "注册账号" }));

    expect(rendered.emitted("login")?.[0]?.[0]).toEqual({
      identification: "momen",
      password: "secret",
    });
    expect(rendered.emitted("register")).toHaveLength(1);
  });
});
