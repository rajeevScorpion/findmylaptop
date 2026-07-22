import { describe, expect, it } from "vitest";
import { filterBlogPosts, type BlogDiscoveryPost } from "./discovery";
import type { BlogCategory } from "./types";

const categories: BlogCategory[] = [
  { id: "buying", name: "Buying Guides", slug: "buying-guides", description: null },
  { id: "specs", name: "Specs Explained", slug: "specs-explained", description: null },
];

const posts: BlogDiscoveryPost[] = [
  {
    id: "1",
    title: "How much RAM do students need?",
    slug: "student-ram",
    excerpt: "A simple memory guide for college laptops.",
    reading_time_minutes: 5,
    category_id: "specs",
    published_at: "2026-07-21T12:00:00.000Z",
  },
  {
    id: "2",
    title: "The practical student laptop guide",
    slug: "student-guide",
    excerpt: "Choose a reliable laptop for college without overspending on RAM.",
    reading_time_minutes: 7,
    category_id: "buying",
    published_at: "2026-06-01T12:00:00.000Z",
  },
];

const now = new Date("2026-07-22T12:00:00.000Z");

describe("filterBlogPosts", () => {
  it("searches title, excerpt, and category names", () => {
    expect(
      filterBlogPosts(posts, categories, {
        query: "memory",
        categorySlug: "",
        timeRange: "all",
      }, now).map((post) => post.id)
    ).toEqual(["1"]);

    expect(
      filterBlogPosts(posts, categories, {
        query: "buying guides",
        categorySlug: "",
        timeRange: "all",
      }, now).map((post) => post.id)
    ).toEqual(["2"]);
  });

  it("prioritises title matches over excerpt matches", () => {
    expect(
      filterBlogPosts(posts, categories, {
        query: "RAM",
        categorySlug: "",
        timeRange: "all",
      }, now).map((post) => post.id)
    ).toEqual(["1", "2"]);
  });

  it("combines category and time filters", () => {
    expect(
      filterBlogPosts(posts, categories, {
        query: "",
        categorySlug: "specs-explained",
        timeRange: "week",
      }, now).map((post) => post.id)
    ).toEqual(["1"]);

    expect(
      filterBlogPosts(posts, categories, {
        query: "",
        categorySlug: "buying-guides",
        timeRange: "week",
      }, now)
    ).toEqual([]);
  });
});

