// Copyright (c) 2022 TikTok Pte. Ltd.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
package com.tiktok.sparkling

import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.tiktok.sparkling.Sparkling.Companion.SPARKLING_CONTEXT_CONTAINER_ID
import com.tiktok.sparkling.Sparkling.Companion.SPARKLING_CONTEXT_SCHEME
import com.tiktok.sparkling.hybridkit.utils.ColorUtil

class SparklingActivity : AppCompatActivity() {
    private var sparklingContainerId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val containerId = intent.getStringExtra(SPARKLING_CONTEXT_CONTAINER_ID)
        sparklingContainerId = containerId
        val sparklingContext =
            SparklingContextTransferStation.getSparklingContext(containerId)
                ?: intent.getStringExtra(SPARKLING_CONTEXT_SCHEME)?.let { scheme ->
                    SparklingContext().also { restored ->
                        if (containerId != null) restored.containerId = containerId
                        restored.scheme = scheme
                        Sparkling.build(this, restored).processSparklingContext(restored)
                        SparklingContextTransferStation.saveSparklingContext(restored)
                    }
                }
        if (!SparklingNavigationStack.register(this, sparklingContext)) {
            SparklingContextTransferStation.releaseSparklingContext(containerId)
            finish()
            return
        }
        initStatusBar(sparklingContext)
        setContentView(R.layout.activity_sparkling)
        initToolBar(sparklingContext)
        if (savedInstanceState == null) {
            initSparklingFragment(sparklingContext)
        }
    }

    private fun initStatusBar(sparklingContext: SparklingContext?) {
        val param = sparklingContext?.hybridSchemeParam ?: return
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        when {
            param.hideStatusBar -> {
                controller.hide(WindowInsetsCompat.Type.statusBars())
                controller.systemBarsBehavior =
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }

            param.transStatusBar -> {
                WindowCompat.setDecorFitsSystemWindows(window, false)
                window.statusBarColor = Color.TRANSPARENT
            }
        }
    }

    fun initToolBar(sparklingContext: SparklingContext?) {
        val customToolbar = sparklingContext?.sparklingUIProvider?.getToolBar(this)
        val activeToolbar: Toolbar
        if (customToolbar != null) {
            val defaultToolbar = findViewById<Toolbar>(R.id.toolbar)
            val parent = defaultToolbar.parent as? ViewGroup
            parent?.removeView(defaultToolbar)
            parent?.addView(customToolbar, 0)
            setSupportActionBar(customToolbar)
            activeToolbar = customToolbar
        } else {
            val toolbar = findViewById<Toolbar>(R.id.toolbar)
            setSupportActionBar(toolbar)
            activeToolbar = toolbar
        }

        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = sparklingContext?.hybridSchemeParam?.title ?: getString(R.string.sparkling_page_title)

        val titleColorStr = sparklingContext?.hybridSchemeParam?.titleColor
        if (!titleColorStr.isNullOrEmpty()) {
            try {
                val titleColor = Color.parseColor(titleColorStr)
                activeToolbar.setTitleTextColor(titleColor)
            } catch (e: IllegalArgumentException) {
            }
        }

        val navBarColorStr = sparklingContext?.hybridSchemeParam?.navBarColor
        if (!navBarColorStr.isNullOrEmpty()) {
            val navBarColor = ColorUtil.parseColorSafely(navBarColorStr)
            activeToolbar.setBackgroundColor(navBarColor)
        }

        activeToolbar.setNavigationOnClickListener {
            onBackPressed()
        }
    }

    fun initSparklingFragment(sparklingContext: SparklingContext?) {
        sparklingContext?.hybridSchemeParam?.let {
            if (it.hideNavBar || (it.transStatusBar && !it.showNavBarInTransStatusBar)) {
                supportActionBar?.hide()
            }
            requestedOrientation =
                when (it.screenOrientation) {
                    "portrait" -> android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    "landscape" -> android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    else -> android.content.pm.ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                }
        }

        val fragment = SparklingFragment.newInstance()
        supportFragmentManager
            .beginTransaction()
            .replace(R.id.main_view_container, fragment)
            .commit()
    }

    override fun onResume() {
        super.onResume()
    }

    private var lastBackPressedTime: Long = 0
    private val DOUBLE_CLICK_EXIT_INTERVAL = 2000

    override fun onBackPressed() {
        if (isTaskRoot) {
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastBackPressedTime < DOUBLE_CLICK_EXIT_INTERVAL) {
                SparklingNavigationStack.markUserBack(sparklingContainerId)
                super.onBackPressed()
            } else {
                Toast.makeText(this, getString(R.string.click_again_to_exit), Toast.LENGTH_SHORT).show()
                lastBackPressedTime = currentTime
            }
        } else {
            SparklingNavigationStack.markUserBack(sparklingContainerId)
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (isFinishing) {
            SparklingNavigationStack.unregister(sparklingContainerId)
            SparklingContextTransferStation.releaseSparklingContext(sparklingContainerId)
        }
        super.onDestroy()
    }
}
