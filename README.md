# Absolute Age Dating Explorer (Half-life)

A lightweight, browser-based teaching tool for introductory geology that lets students explore **radiometric (absolute) age dating** by adjusting the **parent/daughter** proportions and seeing the **computed age** from a chosen **half-life**.

## Features
- Slider from **0–100% daughter** (and 100–0% parent)
- Auto-calculates:
  - **Parent remaining (%)**
  - **Number of half-lives elapsed**
  - **Sample age** (auto-formatted as years/kyr/Myr/Gyr)
- Drop-down **isotope system** presets (plus **Custom**)
- Drop-down unit selector for half-life: **years, kyr, Myr, Gyr**
- Visuals:
  - 100-dot grid (each dot ≈ 1%)
  - percent bar

## Assumptions
This simplified model assumes:
1. **Initial daughter = 0** (all atoms start as parent)
2. **Closed system** (no parent/daughter added/removed)

Equation used:

> N/N0 = (1/2)^(t/t1/2)

Rearranged:

> t = t1/2 · log2(N0/N)

In the app, **N/N0** is the **parent fraction remaining**.

## Run locally
Just open `index.html` in a browser.



---
Created for UHCL introductory geology teaching.
