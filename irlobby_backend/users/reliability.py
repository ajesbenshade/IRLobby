from django.db.models import Avg, Count, Q


def build_reliability_summary(user):
    from activities.models import TicketRedemptionLog
    from reviews.models import Review

    review_stats = Review.objects.filter(reviewee=user).aggregate(
        average_rating=Avg("rating"),
        review_count=Count("id"),
    )
    validation_stats = TicketRedemptionLog.objects.filter(host=user).aggregate(
        total=Count("id"),
        successful=Count("id", filter=Q(successful=True)),
    )

    average_rating = review_stats["average_rating"]
    review_count = review_stats["review_count"] or 0
    validation_count = validation_stats["total"] or 0
    successful_validations = validation_stats["successful"] or 0

    review_score = (float(average_rating) / 5) * 100 if average_rating is not None else None
    validation_rate = (
        (successful_validations / validation_count) * 100 if validation_count else None
    )

    if review_score is not None and validation_rate is not None:
        score = round((review_score * 0.75) + (validation_rate * 0.25))
    elif review_score is not None:
        score = round(review_score)
    elif validation_rate is not None:
        score = round(validation_rate)
    else:
        score = None

    return {
        "score": score,
        "label": get_reliability_label(score, review_count, validation_count),
        "reviewCount": review_count,
        "averageRating": round(float(average_rating), 2) if average_rating is not None else None,
        "ticketValidationRate": round(validation_rate) if validation_rate is not None else None,
        "successfulTicketValidations": successful_validations,
        "ticketValidationCount": validation_count,
    }


def get_reliability_label(score, review_count, validation_count):
    if score is None or (review_count == 0 and validation_count == 0):
        return "New profile"
    if score >= 90:
        return "Highly reliable"
    if score >= 75:
        return "Reliable"
    if score >= 60:
        return "Building trust"
    return "Limited signal"
