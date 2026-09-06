# Zhen-Hai HUD Manager

[中文文档](./README_ZH.md)

Previously known as Void HUD Manager, this project has been fully rebuilt and officially renamed to Zhen-Hai HUD Manager.

The name “Zhenhai” (Chinese: 镇海) is inspired by the Zhan'ao Pagoda in Haining, Zhejiang, China.

## Introduction

Zhen-Hai HUD Manager is a HUD management tool designed for Counter-Strike esports live broadcasts. It is used to manage tournaments, teams, players, and overlay content.

This refactor comprehensively improves the original project architecture, user interface interactions, and overall workflow, making the system clearer, more stable, and easier to use.

Compared with the legacy Void HUD Manager, Zhen-Hai HUD Manager delivers significant improvements in architecture, feature experience, and operational flow.

## Key Features

### Tournament Management

Supports creating and switching between multiple tournaments, reducing the need to repeatedly fill out large forms and improving tournament configuration efficiency.

### Improved Form Experience

The forms for matches, teams, and players have been redesigned to provide clearer field structures and more intuitive interactions.

### Automatic GSI File Placement

The application can automatically detect the game installation path and place the GSI configuration file for you, reducing manual setup steps.

### Automatic Updates

Built-in automatic update support is included, with an improved update experience compared to previous versions.

### Overlay UI Customization

Supports customizing overlay colors, corner radius, safe area, and visible components, allowing users to tailor the overlay to their broadcast layout.

## Technical Architecture

Following this refactor, the project has been upgraded from the previous dual-repository structure:

- `Void-HUD-Manager`
- `Void-HUD-Overlay`

to a single-repository structure:

- `ZhenHai-HUD-Manager`

The project uses Turborepo for multi-package management.

### Electron Frontend

Built with the following technologies:

- Vue 3
- Pinia
- Nuxt UI
- TailwindCSS
- Vue Router

### Electron Backend

Built with the following technologies:

- Electron
- Express
- LowDB
- [osztenkurden/csgogsi](https://github.com/osztenkurden/csgogsi)

### Overlay Layer

Built with the following technologies:

- Vue 3
- Pinia
- TailwindCSS

## Quick Start

### 1. Download and Install

Download and install Zhen-Hai HUD Manager.

### 2. Launch the Application

Start the application and follow the built-in Setup Wizard to complete the initial configuration.

### 3. Configure Tournament Data

Add the following items in order:

- Players
- Teams
- Matches

After that, set the relevant match to Live.

### 4. Launch the Game

Start the game and make sure the GSI configuration is working correctly.

### 5. Open the Overlay

Click the Overlay button in the application.

### 6. Add a Browser Source

In OBS or vMix, add a browser source using the following recommended settings:

- Width: `1920`
- Height: `1080`
- Source URL: Refer to the Overlay card under Commands & Links in the application

The default URL is usually:

`http://127.0.0.1:1469/overlay/`

After completing these steps, you can use Zhen-Hai HUD Manager in your live broadcast.

## Summary of Improvements

Compared with previous versions, Zhen-Hai HUD Manager introduces the following changes:

- Migrated from two GitHub repositories to a single Turborepo repository
- Refactored the project structure to improve maintainability
- Improved tournament, team, player, and match management workflows
- Added automatic detection of the game path and automatic placement of the GSI file
- Enhanced the automatic update mechanism
- Provided more flexible overlay UI customization options

## Acknowledgements

Thanks to the following projects and communities for their support:

- [cshuds.com](https://cshuds.com)
- [JTsHM / OpenHUD](https://github.com/JohnTimmermann/OpenHud)
- [drweissbrot / cs-hud](https://github.com/drweissbrot/cs-hud)

And thank you to everyone who has contributed help and support to this project.