class CommentSystem {
  constructor(gameId, config = {}) {
    this.gameId = gameId;
    this.commentOffset = 0;
    this.alertMsgTooshort =
      "Your comment is too short. Please enter at least {{min}} characters.";
    this.config = {
      commentsPerLoad: config.commentsPerLoad || 5,
      maxReplies: config.maxReplies || 10,
      minChars: config.minChars || 3,
      dateFormat: config.dateFormat || "timeAgo",
    };
    this.init();
  }
  init() {
    this.loadComments();
    this.setupCommentPostForm();
    this.alertMsgTooshort = this.alertMsgTooshort.replace(
      "{{min}}",
      this.config.minChars
    );
    document
      .getElementById("tpl-btn-load-more-comments")
      .addEventListener("click", () => this.loadMoreComments());
    document
      .getElementById("tpl-comment-section")
      .addEventListener("click", (event) => {
        let targetElement = event.target;
        while (targetElement != null) {
          if (targetElement.matches(".tpl-btn-show-replies")) {
            const commentId = targetElement.getAttribute("data-id");
            this.loadReplies(commentId);
            return;
          } else if (targetElement.matches(".tpl-btn-hide-replies")) {
            const commentId = targetElement.getAttribute("data-id");
            this.hideReplies(commentId);
            return;
          } else if (targetElement.matches(".tpl-comment-reply")) {
            event.preventDefault();
            const closestElement = targetElement.closest(".tpl-user-comment");
            const commentId = closestElement.getAttribute("data-id");
            this.renderReplyForm(commentId);
            return;
          }
          targetElement = targetElement.parentElement;
        }
      });
  }
  getConvertedDate(dateString, serverDate) {
    const date = new Date(dateString);
    const now = new Date(serverDate);
    if (this.config.dateFormat === "ISO") {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } else if (this.config.dateFormat === "timeAgo") {
      const diffInSeconds = Math.floor((now - date) / 1000);
      const years = Math.floor(diffInSeconds / (3600 * 24 * 365));
      const months = Math.floor(diffInSeconds / (3600 * 24 * 30));
      const days = Math.floor(diffInSeconds / (3600 * 24));
      const hours = Math.floor(diffInSeconds / 3600);
      const minutes = Math.floor(diffInSeconds / 60);
      if (years > 0) {
        return `${years}${years === 1 ? "year" : "years"}ago`;
      } else if (months > 0) {
        return `${months}${months === 1 ? "month" : "months"}ago`;
      } else if (days > 0) {
        return `${days}${days === 1 ? "day" : "days"}ago`;
      } else if (hours > 0) {
        return `${hours}${hours === 1 ? "hour" : "hours"}ago`;
      } else if (minutes > 0) {
        return `${minutes}${minutes === 1 ? "minute" : "minutes"}ago`;
      } else {
        return "Just now";
      }
    } else {
      throw new Error("Invalid config value");
    }
  }
  renderReplyForm(commentId) {
    const existingReplyForm = document.querySelector(
      "#tpl-comment-list .tpl-reply-form"
    );
    if (existingReplyForm) existingReplyForm.remove();
    const commentElem = document.querySelector(
      `.tpl-user-comment[data-id="${commentId}"]`
    );
    const replyFormTemplate = document
      .querySelector("#tpl-comment-template .tpl-reply-form")
      .cloneNode(true);
    const sendReplyBtn = replyFormTemplate.querySelector(".tpl-btn-send-reply");
    sendReplyBtn.setAttribute("data-id", commentId);
    replyFormTemplate
      .querySelector(".tpl-btn-send-reply")
      .addEventListener("click", (e) => {
        e.preventDefault();
        const content =
          replyFormTemplate.querySelector(".tpl-reply-input").value;
        this.postComment(content, commentId);
        replyFormTemplate.remove();
      });
    const cancelReplyBtn = replyFormTemplate.querySelector(
      ".tpl-btn-cancel-reply"
    );
    if (cancelReplyBtn) {
      cancelReplyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        replyFormTemplate.remove();
      });
    }
    commentElem
      .querySelector(".tpl-reply-form-wrapper")
      .appendChild(replyFormTemplate);
  }
  loadReplies(commentId, forceLoad = false) {
    const parentCommentElem = document.querySelector(
      `.tpl-user-comment[data-id="${commentId}"]`
    );
    const showRepliesBtn = parentCommentElem.querySelector(
      ".tpl-btn-show-replies"
    );
    const hideRepliesBtn = parentCommentElem.querySelector(
      ".tpl-btn-hide-replies"
    );
    const commentChildren = parentCommentElem.querySelector(
      ".tpl-comment-children"
    );
    if (showRepliesBtn) showRepliesBtn.style.display = "none";
    const repliesHTML = commentChildren.innerHTML;
    if (repliesHTML && repliesHTML.trim() !== "" && !forceLoad) {
      commentChildren.style.display = "block";
      if (hideRepliesBtn) hideRepliesBtn.style.display = "block";
    } else {
      fetch("/includes/comment.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `load_replies=true&amount=${this.config.maxReplies}&game_id=${this.gameId}&parent_id=${commentId}`,
      })
        .then((response) => {
          if (hideRepliesBtn) hideRepliesBtn.style.display = "block";
          return response.json();
        })
        .then((replies) => {
          if (replies && replies.length > 0) {
            const transformedReplies = this.transformData(replies);
            const childrenHtml = this.renderCommentsRecursive(
              transformedReplies,
              true
            );
            commentChildren.innerHTML = childrenHtml;
          }
        })
        .catch((error) => {
          console.error("Failed to load replies:", error);
        });
    }
  }
  hideReplies(commentId) {
    const parentCommentElem = document.querySelector(
      `.tpl-user-comment[data-id="${commentId}"]`
    );
    const hideRepliesBtn = parentCommentElem.querySelector(
      ".tpl-btn-hide-replies"
    );
    const commentChildren = parentCommentElem.querySelector(
      ".tpl-comment-children"
    );
    const showRepliesBtn = parentCommentElem.querySelector(
      ".tpl-btn-show-replies"
    );
    if (hideRepliesBtn) {
      hideRepliesBtn.style.display = "none";
    }
    if (commentChildren) {
      commentChildren.style.display = "none";
    }
    if (showRepliesBtn) {
      showRepliesBtn.style.display = "block";
    }
  }
  setupCommentPostForm() {
    const tooShortElem = document.querySelector(
      "#tpl-comment-form .tpl-alert-tooshort"
    );
    if (tooShortElem) {
      this.alertMsgTooshort = tooShortElem.innerHTML;
      tooShortElem.parentNode.removeChild(tooShortElem);
    }
    const postCommentBtn = document.querySelector(
      "#tpl-comment-form .tpl-post-comment-btn"
    );
    const commentInput = document.querySelector(
      "#tpl-comment-form .tpl-comment-input"
    );
    if (postCommentBtn) {
      postCommentBtn.addEventListener("click", () => {
        const commentContent = commentInput.value;
        if (commentContent) {
          this.postComment(commentContent);
          commentInput.value = "";
        }
      });
    }
  }
  postComment(content, parent = null) {
    if (content.length < this.config.minChars) {
      alert(this.alertMsgTooshort);
      return;
    }
    const requestData = {
      send_comment: true,
      game_id: this.gameId,
      parent: parent,
      content: content,
    };
    const formData = new URLSearchParams(requestData);
    fetch("/includes/comment.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    })
      .then((response) => response.text())
      .then((response) => {
        console.log(response);
        if (response === "success") {
          if (parent !== null) {
            this.loadReplies(parent, true);
          } else {
            this.loadComments();
          }
        } else {
          console.log("fail");
        }
      })
      .catch((error) => {
        console.error("Failed to post comment:", error);
      });
  }
  loadComments(isLoadMore = false) {
    const loadMoreButton = document.getElementById(
      "tpl-btn-load-more-comments"
    );
    if (loadMoreButton) {
      loadMoreButton.style.display = "none";
    }
    if (!isLoadMore) {
      this.commentOffset = 0;
    }
    const requestData = {
      load_root_comments: true,
      game_id: encodeURIComponent(this.gameId),
      offset: encodeURIComponent(this.commentOffset),
      amount: encodeURIComponent(this.config.commentsPerLoad),
    };
    const formData = new URLSearchParams(requestData);
    fetch("/includes/comment.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    })
      .then((response) => response.json())
      .then((comments) => {
        if (comments && comments.length > 0) {
          const transformedComments = this.transformData(comments);
          if (isLoadMore) {
            this.renderComments(transformedComments, true);
            this.commentOffset += comments.length;
          } else {
            this.renderComments(transformedComments);
            this.commentOffset = comments.length;
          }
        }
        if (
          comments.length < this.config.commentsPerLoad ||
          comments.length === 0
        ) {
          if (loadMoreButton) {
            loadMoreButton.remove();
          }
        } else {
          if (loadMoreButton) {
            loadMoreButton.style.display = "block";
          }
        }
      })
      .catch((error) => {
        console.error("Failed to load comments:", error);
      });
  }
  loadMoreComments() {
    this.loadComments(true);
  }
  transformData(array) {
    return array.map((item) => {
      return {
        id: Number(item.id),
        parent_id: item.parent_id,
        created: item.created_date,
        content: item.comment,
        has_replies: item.has_replies,
        server_date: item.server_date,
        fullname: item.sender_username || "Anonymous",
        profile_picture_url: item.avatar,
      };
    });
  }
  generateCommentHtmlFromTemplate(comment, isChildren) {
    const template = document
      .querySelector("#tpl-comment-template .tpl-user-comment")
      .cloneNode(true);
    template.setAttribute("data-id", comment.id);
    const elementsWithDataId = template.querySelectorAll("[data-id]");
    elementsWithDataId.forEach((element) =>
      element.setAttribute("data-id", comment.id)
    );
    const authorElement = template.querySelector(".tpl-comment-author");
    if (authorElement) authorElement.textContent = comment.fullname;
    const timestampElement = template.querySelector(".tpl-comment-timestamp");
    if (timestampElement)
      timestampElement.textContent = this.getConvertedDate(
        comment.created,
        comment.server_date
      );
    const textElement = template.querySelector(".tpl-comment-text");
    if (textElement) textElement.textContent = comment.content;
    const avatarElement = template.querySelector("img.tpl-user-comment-avatar");
    if (avatarElement)
      avatarElement.setAttribute("src", comment.profile_picture_url);
    if (isChildren) {
      const replyElement = template.querySelector(".tpl-comment-reply");
      const replyFormWrapperElement = template.querySelector(
        ".tpl-reply-form-wrapper"
      );
      if (replyElement) replyElement.remove();
      if (replyFormWrapperElement) replyFormWrapperElement.remove();
    }
    return template;
  }
  renderCommentsRecursive(data, isChildren = false) {
    let html = "";
    data.forEach((comment) => {
      const commentHtml = this.generateCommentHtmlFromTemplate(
        comment,
        isChildren
      );
      const showRepliesBtn = commentHtml.querySelector(".tpl-btn-show-replies");
      const hideRepliesBtn = commentHtml.querySelector(".tpl-btn-hide-replies");
      if (comment.has_replies) {
        if (showRepliesBtn) showRepliesBtn.style.display = "block";
        if (hideRepliesBtn) hideRepliesBtn.style.display = "none";
      } else {
        if (showRepliesBtn) showRepliesBtn.remove();
        if (hideRepliesBtn) hideRepliesBtn.remove();
      }
      html += commentHtml.outerHTML;
    });
    return html;
  }
  renderComments(data, isLoadMore = false) {
    const html = this.renderCommentsRecursive(data);
    const commentList = document.querySelector("#tpl-comment-list");
    if (isLoadMore) {
      commentList.insertAdjacentHTML("beforeend", html);
    } else {
      commentList.innerHTML = html;
    }
  }
}
