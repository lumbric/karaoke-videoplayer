import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SongRequestForm from "./SongRequestForm.vue";

describe("SongRequestForm", () => {
  it("shows validation message when required fields are missing", async () => {
    const wrapper = mount(SongRequestForm);
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("Bitte Titel und Artist ausfuellen");
  });

  it("saves request successfully", async () => {
    const wrapper = mount(SongRequestForm);

    await wrapper.find('input[placeholder="Songtitel"]').setValue("Wonderwall");
    await wrapper.find('input[placeholder="Artist"]').setValue("Oasis");
    await wrapper.find('input[placeholder="Dein Name"]').setValue("Alex");
    await wrapper.find("form").trigger("submit.prevent");

    expect(wrapper.text()).toContain("Songwunsch wurde gespeichert");
  });

  it("prefills the title when prefillTitle prop is provided", () => {
    const wrapper = mount(SongRequestForm, {
      props: { prefillTitle: "  Test Song  " }
    });

    const titleInput = wrapper.find('input[placeholder="Songtitel"]').element as HTMLInputElement;
    expect(titleInput.value).toBe("Test Song");
  });

  it("renders the requestedBy name field", () => {
    const wrapper = mount(SongRequestForm);

    expect(wrapper.find('input[placeholder="Dein Name"]').exists()).toBe(true);
  });
});
