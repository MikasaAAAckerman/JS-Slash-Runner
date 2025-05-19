/**
 * Collapsible configuration interface
 */
export interface CollapsibleOptions {
  /** Trigger selector */
  headerSelector: string;
  /** Content selector */
  contentSelector: string;
  /** Expanded state class name */
  expandedClass?: string;
  /** Animation duration in milliseconds */
  animationDuration?: {
    expand: number;
    collapse: number;
  };
  /** Animation easing function */
  easingFunction?: string;
  /** Whether initially expanded */
  initiallyExpanded?: boolean;
  /** Callback functions */
  callbacks?: {
    beforeExpand?: () => void;
    afterExpand?: () => void;
    beforeCollapse?: () => void;
    afterCollapse?: () => void;
  };
}

/**
 * Collapsible component class
 */
export class Collapsible {
  private $container: JQuery;
  private $header: JQuery;
  private $content: JQuery;
  private options: CollapsibleOptions;
  private isAnimating: boolean = false;

  /**
   * Static method: Initialize all matching elements as collapsible
   * @param containerSelector Container selector
   * @param options Configuration options
   * @returns Array of Collapsible instances
   */
  public static initAll(containerSelector: string, options: Partial<CollapsibleOptions> = {}): Collapsible[] {
    const instances: Collapsible[] = [];
    $(containerSelector).each(function () {
      instances.push(new Collapsible($(this), options));
    });
    return instances;
  }

  /**
   * Constructor
   * @param $container Container element
   * @param options Configuration options
   */
  constructor($container: JQuery, options: Partial<CollapsibleOptions> = {}) {
    this.$container = $container;

    // Default configuration
    const defaultOptions: CollapsibleOptions = {
      headerSelector: '.collapsible-header',
      contentSelector: '.collapsible-content',
      expandedClass: 'expanded',
      animationDuration: {
        expand: 280,
        collapse: 250,
      },
      easingFunction: 'swing',
      initiallyExpanded: false,
      callbacks: {},
    };

    // Merge configurations
    this.options = { ...defaultOptions, ...options };

    // Get elements
    this.$header = this.$container.find(this.options.headerSelector);
    this.$content = this.$container.find(this.options.contentSelector);

    // Initialize events
    this.initEvents();

    // Set initial state
    if (!this.options.initiallyExpanded) {
      this.$container.removeClass(this.options.expandedClass);
      this.$content.hide();
    } else {
      this.$container.addClass(this.options.expandedClass!);
      this.$content.show();
    }
  }

  /**
   * Initialize events
   */
  private initEvents(): void {
    this.$header.on('click', (event: JQuery.ClickEvent) => {
      // Check if click occurred on a control element, if so don't trigger collapse
      if (this.shouldIgnoreClick(event.target)) {
        return;
      }
      this.toggle();
    });
  }

  /**
   * Determine if click should be ignored (not trigger collapse)
   * @param target Clicked target element
   * @returns Whether click should be ignored
   */
  private shouldIgnoreClick(target: EventTarget): boolean {
    const $target = $(target);

      // Check if clicked on toggle switch or its children
    if (
      $target.hasClass('toggle-switch') ||
      $target.hasClass('toggle-input') ||
      $target.hasClass('toggle-label') ||
      $target.hasClass('toggle-handle') ||
      $target.closest('.toggle-switch').length > 0
    ) {
      return true;
    }

      // Check if clicked on button or its children
    if (
      $target.hasClass('menu_button') ||
      $target.closest('.menu_button').length > 0 ||
      $target.hasClass('TavernHelper-button') ||
      $target.closest('.TavernHelper-button').length > 0
    ) {
      return true;
    }

      // Check if clicked on form elements
    if (
      $target.is('input, select, textarea, button, a') ||
      $target.closest('input, select, textarea, button, a').length > 0
    ) {
      return true;
    }

    return false;
  }

  /**
   * Toggle expand/collapse state
   */
  public toggle(): void {
    if (this.isAnimating) return;

    if (this.$container.hasClass(this.options.expandedClass!)) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  /**
   * Expand content
   */
  public expand(): void {
    if (this.isAnimating || this.$container.hasClass(this.options.expandedClass!)) return;

    this.isAnimating = true;

    // Execute before expand callback
    if (this.options.callbacks?.beforeExpand) {
      this.options.callbacks.beforeExpand();
    }

    this.$container.addClass(this.options.expandedClass!);
    this.$content.addClass('animating');

    this.$content.slideDown({
      duration: this.options.animationDuration!.expand,
      easing: this.options.easingFunction,
      start: function () {
        $(this).css({
          opacity: 0,
          transform: 'translateY(-10px) scaleY(0.95)',
        });
      },
      progress: function (_animation, progress) {
        $(this).css({
          opacity: progress,
          transform: `translateY(${-10 * (1 - progress)}px) scaleY(${0.95 + 0.05 * progress})`,
        });
      },
      complete: () => {
        this.$content
          .css({
            opacity: '',
            transform: '',
          })
          .removeClass('animating');

        this.isAnimating = false;

        // Execute after expand callback
        if (this.options.callbacks?.afterExpand) {
          this.options.callbacks.afterExpand();
        }
      },
    });
  }

  /**
   * Collapse content
   */
  public collapse(): void {
    if (this.isAnimating || !this.$container.hasClass(this.options.expandedClass!)) return;

    this.isAnimating = true;

    // Execute before collapse callback
    if (this.options.callbacks?.beforeCollapse) {
      this.options.callbacks.beforeCollapse();
    }

    this.$container.removeClass(this.options.expandedClass!);
    this.$content.addClass('animating');

    this.$content.slideUp({
      duration: this.options.animationDuration!.collapse,
      easing: this.options.easingFunction,
      start: function () {
        $(this).css({
          opacity: 1,
          transform: 'translateY(0) scaleY(1)',
        });
      },
      progress: function (_animation, progress) {
        const inverseProgress = 1 - progress;
        $(this).css({
          opacity: inverseProgress,
          transform: `translateY(${-5 * progress}px) scaleY(${1 - 0.05 * progress})`,
        });
      },
      complete: () => {
        this.$content
          .css({
            opacity: '',
            transform: '',
          })
          .removeClass('animating');

        this.isAnimating = false;

        // Execute after collapse callback
        if (this.options.callbacks?.afterCollapse) {
          this.options.callbacks.afterCollapse();
        }
      },
    });
  }

  /**
   * Check if expanded
   * @returns Whether expanded
   */
  public isExpanded(): boolean {
    return this.$container.hasClass(this.options.expandedClass!);
  }

  /**
   * Destroy instance, remove event listeners
   */
  public destroy(): void {
    this.$header.off('click');
  }
}
