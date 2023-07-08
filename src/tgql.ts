import { Thunder } from "@/generated/zeus";

export const tgql = Thunder(async (query) => {
  const response = await fetch(`/api`, {
    body: JSON.stringify({ query }),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // access_token: localStorage.getItem("access_token") || "",
      // refresh_token: localStorage.getItem("refresh_token") || "",
      // Authorization: "Bearer " + localStorage.getItem("access_token") || "",
    },
    credentials: "include",
    cache: "no-store",
  });

  // console.log({ response });

  if (!response.ok) {
    const text = await response.text();

    try {
      throw JSON.parse(text);
    } catch (error) {
      throw text;
    }
    // return new Promise((resolve, reject) => {
    //   response
    //     .text()
    //     .then((text) => {
    //       try {
    //         reject(JSON.parse(text));
    //       } catch (err) {
    //         reject(text);
    //       }
    //     })
    //     .catch(reject);
    // });
  }

  const json = await response.json();

  // console.log({ json });

  if (json.errors) {
    throw json.errors;
    // return new Promise((resolve, reject) => {
    //   try {
    //     reject(JSON.parse(json.errors));
    //   } catch (err) {
    //     reject(json.errors);
    //   }
    // });
  }

  return json.data;
});

export const tquery = tgql("query");
export const tmutate = tgql("mutation");
