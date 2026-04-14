<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

const isStrategyExpanded = ref(true)
const HISTORY_MODAL_OPEN_EVENT = 'open-history-modal'

function openHistoryModal() {
  window.dispatchEvent(new CustomEvent(HISTORY_MODAL_OPEN_EVENT))
}

const toggleStrategy = () => {
  isStrategyExpanded.value = !isStrategyExpanded.value
}
</script>

<template>
  <!-- <div class="layout">
    <header class="topbar">
      <div class="topbar-left">
        <div class="topbar-brand-wrap">
          <span class="brand-mark material-symbols-outlined" aria-hidden="true">edit_note</span>
          <div class="brand-stack">
            <RouterLink to="/" class="brand">The Editorial Workspace</RouterLink>
            <nav class="topbar-breadcrumb" aria-label="Document breadcrumb">
              <span>Home</span>
              <span class="crumb-sep material-symbols-outlined" aria-hidden="true">chevron_right</span>
              <span>Marketing</span>
              <span class="crumb-sep material-symbols-outlined" aria-hidden="true">chevron_right</span>
              <span class="active">Strategy</span>
            </nav>
          </div>
        </div>

        <nav class="topbar-tabs" aria-label="Workspace command tabs">
          <button type="button" class="tab-btn active">File</button>
          <button type="button" class="tab-btn">Insert</button>
          <button type="button" class="tab-btn">Format</button>
          <button type="button" class="tab-btn">Tools</button>
        </nav>
      </div>

      <div class="topbar-actions">
        <button type="button" class="icon-btn" aria-label="History" @click="openHistoryModal">
          <span class="material-symbols-outlined">history</span>
        </button>
        <button type="button" class="icon-btn" aria-label="Favorite">
          <span class="material-symbols-outlined">star</span>
        </button>
        <button type="button" class="icon-btn has-dot" aria-label="Notification">
          <span class="material-symbols-outlined">notifications</span>
        </button>

        <button type="button" class="btn ghost">Collaborate</button>
        <button type="button" class="btn primary">Share</button>
        <span class="avatar-chip">L</span>
      </div>
    </header>

    <aside class="workspace-sidebar" aria-label="Workspace navigation">
      <div class="workspace-sidebar-head">
        <div class="workspace-logo">E</div>
        <div>
          <h2>Editorial</h2>
          <p>The Digital Atheneum</p>
        </div>
      </div>

      <button type="button" class="btn workspace-new-btn">
        <span class="material-symbols-outlined" aria-hidden="true">add</span>
        <span>New Document</span>
      </button>

      <div class="workspace-sidebar-scroll">
        <section class="sidebar-group">
          <h3>Workspace</h3>
          <div class="tree-folder">
            <button
              type="button"
              class="tree-item tree-row folder-row"
              :aria-expanded="isStrategyExpanded"
              aria-controls="workspace-strategy-children"
              @click="toggleStrategy"
            >
              <span
                class="material-symbols-outlined tree-icon folder-toggle-icon"
                aria-hidden="true"
              >
                {{ isStrategyExpanded ? 'expand_more' : 'chevron_right' }}
              </span>
              <span
                class="material-symbols-outlined tree-icon"
                aria-hidden="true"
              >
                {{ isStrategyExpanded ? 'folder_open' : 'folder' }}
              </span>
              <span>Strategy</span>
            </button>
            <div
              v-show="isStrategyExpanded"
              id="workspace-strategy-children"
              class="tree-children"
            >
              <button type="button" class="tree-item tree-row active">
                <span class="material-symbols-outlined tree-icon">description</span>
                <span>Q4 Content Strategy</span>
              </button>
              <button type="button" class="tree-item tree-row">
                <span class="material-symbols-outlined tree-icon">description</span>
                <span>2025 Roadmap</span>
              </button>
            </div>
          </div>
          <button type="button" class="tree-item tree-row">
            <span class="material-symbols-outlined tree-icon">description</span>
            <span>Global Campaign</span>
          </button>
        </section>

        <section class="sidebar-group">
          <h3>Resources</h3>
          <button type="button" class="tree-item tree-row">
            <span class="material-symbols-outlined tree-icon">chevron_right</span>
            <span class="material-symbols-outlined tree-icon">folder</span>
            <span>Research</span>
          </button>
          <button type="button" class="tree-item tree-row">
            <span class="material-symbols-outlined tree-icon">chevron_right</span>
            <span class="material-symbols-outlined tree-icon">folder_shared</span>
            <span>Shared</span>
          </button>
          <button type="button" class="tree-item tree-row">
            <span class="material-symbols-outlined tree-icon">chevron_right</span>
            <span class="material-symbols-outlined tree-icon">folder</span>
            <span>Archive</span>
          </button>
          <button type="button" class="tree-item tree-row">
            <span class="material-symbols-outlined tree-icon">chevron_right</span>
            <span class="material-symbols-outlined tree-icon">folder</span>
            <span>Brand System</span>
          </button>
          <button type="button" class="tree-item tree-row">
            <span class="material-symbols-outlined tree-icon">chevron_right</span>
            <span class="material-symbols-outlined tree-icon">folder</span>
            <span>Launch Calendar</span>
          </button>
          <button type="button" class="tree-item tree-row">
            <span class="material-symbols-outlined tree-icon">chevron_right</span>
            <span class="material-symbols-outlined tree-icon">folder</span>
            <span>Meeting Notes</span>
          </button>
          <button type="button" class="tree-item tree-row">
            <span class="material-symbols-outlined tree-icon">chevron_right</span>
            <span class="material-symbols-outlined tree-icon">folder</span>
            <span>Draft Archive</span>
          </button>
        </section>
      </div>

      <section class="sidebar-footer">
        <button type="button" class="tree-item tree-row footer-item">
          <span class="material-symbols-outlined tree-icon">settings</span>
          <span>Settings</span>
        </button>
        <button type="button" class="tree-item tree-row footer-item">
          <span class="material-symbols-outlined tree-icon">delete</span>
          <span>Trash</span>
        </button>
      </section>
    </aside>

    <aside class="outline-sidebar" aria-label="Document outline">
      <div class="outline-head">
        <span>Outline</span>
        <span class="material-symbols-outlined" aria-hidden="true">unfold_more</span>
      </div>
      <nav class="outline-list">
        <a href="javascript:void(0)" class="outline-link active">1. Executive Overview</a>
        <a href="javascript:void(0)" class="outline-link sub">01 Research Phase</a>
        <a href="javascript:void(0)" class="outline-link sub">02 Iterative Drafting</a>
        <a href="javascript:void(0)" class="outline-link">2. Core Methodology</a>
        <a href="javascript:void(0)" class="outline-link sub">2.1 Content Pillars</a>
        <a href="javascript:void(0)" class="outline-link">3. Distribution Channels</a>
        <a href="javascript:void(0)" class="outline-link sub">3.1 Partner Channels</a>
        <a href="javascript:void(0)" class="outline-link sub">3.2 Social Distribution</a>
        <a href="javascript:void(0)" class="outline-link">4. Execution Timeline</a>
        <a href="javascript:void(0)" class="outline-link sub">4.1 Milestones</a>
        <a href="javascript:void(0)" class="outline-link sub">4.2 Owners</a>
      </nav>
    </aside>

    <main class="content">
      <div class="content-inner">
        <RouterView />
      </div>
    </main>
  </div> -->

   <!-- <main class="content">
      <div class="content-inner"> -->
        <RouterView />
      <!-- </div>
    </main> -->
</template>

